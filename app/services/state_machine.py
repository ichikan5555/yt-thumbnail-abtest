"""Test lifecycle state machine."""

import json
import logging
import random
from datetime import datetime
from pathlib import Path

from app.config import settings
from app.database import get_session
from app.models import ABTest, Measurement, TestStatus, Variant

logger = logging.getLogger(__name__)


class StateMachine:
    def create_test(
        self, video_id: str, image_paths: list[str], video_title: str = "",
        rotation_interval: int | None = None,
        cycles: int | None = None,
        scheduled_start: "datetime | None" = None,
        scheduled_end: "datetime | None" = None,
        metric_weights: str | None = None,
    ) -> ABTest:
        """Create a new A/B test with variants."""
        labels = ["A", "B", "C", "D"][:len(image_paths)]
        session = get_session()
        try:
            test = ABTest(
                video_id=video_id,
                video_title=video_title,
                status=TestStatus.PENDING,
                cycles=cycles or settings.cycles,
                rotation_interval=rotation_interval or settings.rotation_interval_minutes,
                scheduled_start=scheduled_start,
                scheduled_end=scheduled_end,
                metric_weights=metric_weights or "",
            )
            session.add(test)
            session.flush()

            for label, path in zip(labels, image_paths):
                abs_path = str(Path(path).resolve())
                variant = Variant(
                    ab_test_id=test.id,
                    label=label,
                    image_path=abs_path,
                )
                session.add(variant)

            session.commit()
            session.refresh(test)
            logger.info("Created test #%d for video %s (%d variants)", test.id, video_id, len(labels))
            return test
        finally:
            session.close()

    def start_test(self, test_id: int) -> ABTest:
        """Transition test from PENDING to RUNNING and generate rotation order."""
        session = get_session()
        try:
            test = session.get(ABTest, test_id)
            if test is None:
                raise ValueError(f"Test #{test_id} not found")
            if test.status != TestStatus.PENDING:
                raise ValueError(
                    f"Test #{test_id} is {test.status.value}, expected pending"
                )

            test.status = TestStatus.RUNNING
            test.started_at = datetime.utcnow()
            test.current_cycle = 0
            test.current_variant_index = 0
            test.rotation_order = self._generate_rotation_order(test.id)

            session.commit()
            session.refresh(test)
            logger.info("Started test #%d, rotation: %s", test.id, test.rotation_order)
            return test
        finally:
            session.close()

    def _generate_rotation_order(self, test_id: int) -> str:
        """Generate a randomized rotation order for bias prevention."""
        session = get_session()
        try:
            variants = session.query(Variant).filter_by(ab_test_id=test_id).all()
            labels = [v.label for v in variants]
        finally:
            session.close()
        random.shuffle(labels)
        return json.dumps(labels)

    def get_current_variant(self, test: ABTest) -> Variant | None:
        """Get the variant that should currently be active."""
        order = json.loads(test.rotation_order)
        if test.current_variant_index >= len(order):
            return None
        current_label = order[test.current_variant_index]

        session = get_session()
        try:
            return (
                session.query(Variant)
                .filter_by(ab_test_id=test.id, label=current_label)
                .first()
            )
        finally:
            session.close()

    def record_rotation_start(
        self, test_id: int, variant_id: int, view_count: int
    ) -> Measurement:
        """Record the start of a rotation period."""
        session = get_session()
        try:
            test = session.get(ABTest, test_id)
            measurement = Measurement(
                ab_test_id=test_id,
                variant_id=variant_id,
                cycle=test.current_cycle,
                view_count_start=view_count,
            )
            session.add(measurement)
            session.commit()
            session.refresh(measurement)
            return measurement
        finally:
            session.close()

    def record_rotation_end(self, measurement_id: int, view_count: int) -> Measurement:
        """Record the end of a rotation period and calculate velocity."""
        session = get_session()
        try:
            m = session.get(Measurement, measurement_id)
            m.view_count_end = view_count
            m.ended_at = datetime.utcnow()

            duration_sec = (m.ended_at - m.started_at).total_seconds()
            m.duration_minutes = duration_sec / 60.0
            duration_hours = duration_sec / 3600.0

            views_gained = view_count - m.view_count_start
            m.velocity = views_gained / duration_hours if duration_hours > 0 else 0.0

            # Update variant aggregates
            variant = session.get(Variant, m.variant_id)
            variant.total_velocity += m.velocity
            variant.measurement_count += 1

            session.commit()
            session.refresh(m)
            logger.info(
                "Rotation end: variant %s, +%d views, %.1f views/h",
                variant.label, views_gained, m.velocity,
            )
            return m
        finally:
            session.close()

    def advance_rotation(self, test_id: int) -> tuple[bool, bool]:
        """Advance to next variant/cycle. Returns (cycle_complete, test_complete)."""
        session = get_session()
        try:
            test = session.get(ABTest, test_id)
            order = json.loads(test.rotation_order)

            test.current_variant_index += 1

            if test.current_variant_index >= len(order):
                # Cycle complete
                test.current_cycle += 1
                test.current_variant_index = 0

                if test.current_cycle >= test.cycles:
                    # All cycles complete
                    session.commit()
                    return True, True

                # New cycle, new random order
                test.rotation_order = self._generate_rotation_order(test.id)
                session.commit()
                return True, False

            session.commit()
            return False, False
        finally:
            session.close()

    def complete_test(self, test_id: int, winner_variant_id: int) -> ABTest:
        """Mark test as completed with winner."""
        session = get_session()
        try:
            test = session.get(ABTest, test_id)
            test.status = TestStatus.COMPLETED
            test.completed_at = datetime.utcnow()
            test.winner_variant_id = winner_variant_id
            session.commit()
            session.refresh(test)
            logger.info("Test #%d completed, winner: variant #%d", test_id, winner_variant_id)
            return test
        finally:
            session.close()

    def pause_test(self, test_id: int) -> ABTest:
        session = get_session()
        try:
            test = session.get(ABTest, test_id)
            if test.status != TestStatus.RUNNING:
                raise ValueError(f"Test #{test_id} is not running")
            test.status = TestStatus.PAUSED
            session.commit()
            session.refresh(test)
            return test
        finally:
            session.close()

    def resume_test(self, test_id: int) -> ABTest:
        session = get_session()
        try:
            test = session.get(ABTest, test_id)
            if test.status != TestStatus.PAUSED:
                raise ValueError(f"Test #{test_id} is not paused")
            test.status = TestStatus.RUNNING
            session.commit()
            session.refresh(test)
            return test
        finally:
            session.close()

    def cancel_test(self, test_id: int) -> ABTest:
        session = get_session()
        try:
            test = session.get(ABTest, test_id)
            if test.status in (TestStatus.COMPLETED, TestStatus.CANCELLED):
                raise ValueError(f"Test #{test_id} is already {test.status.value}")
            test.status = TestStatus.CANCELLED
            session.commit()
            session.refresh(test)
            return test
        finally:
            session.close()

    def set_error(self, test_id: int, message: str) -> ABTest:
        session = get_session()
        try:
            test = session.get(ABTest, test_id)
            test.status = TestStatus.ERROR
            test.error_message = message
            session.commit()
            session.refresh(test)
            return test
        finally:
            session.close()

    def get_running_tests(self) -> list[ABTest]:
        """Get all tests that are currently running (for crash recovery)."""
        session = get_session()
        try:
            return session.query(ABTest).filter_by(status=TestStatus.RUNNING).all()
        finally:
            session.close()


state_machine = StateMachine()
