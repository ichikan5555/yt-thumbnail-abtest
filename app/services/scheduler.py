"""APScheduler-based rotation scheduler with crash recovery."""

import json
import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings
from app.database import get_session
from app.models import ABTest, DegradationCheck, Measurement, TestStatus, Variant
from app.services.analyzer import analyzer
from app.services.notifier import notifier
from app.services.state_machine import state_machine
from app.services.youtube_api import youtube_api

logger = logging.getLogger(__name__)


class RotationScheduler:
    def __init__(self) -> None:
        self._scheduler = BackgroundScheduler()
        self._active_measurements: dict[int, int] = {}  # test_id -> measurement_id

    def start(self) -> None:
        if not self._scheduler.running:
            self._scheduler.start()
            logger.info("Scheduler started")

    def stop(self) -> None:
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info("Scheduler stopped")

    def schedule_test(self, test_id: int) -> None:
        """Start running a test: set first thumbnail, schedule rotations."""
        session = get_session()
        try:
            test = session.get(ABTest, test_id)
            if test.status != TestStatus.RUNNING:
                raise ValueError(f"Test #{test_id} is not in running state")

            # Set first thumbnail and record measurement start
            self._begin_rotation(test_id)

            # Use per-test interval (fallback to global setting)
            interval = test.rotation_interval or settings.rotation_interval_minutes
            self._scheduler.add_job(
                self._rotate,
                "interval",
                minutes=interval,
                args=[test_id],
                id=f"test_{test_id}",
                replace_existing=True,
                next_run_time=datetime.utcnow() + timedelta(minutes=interval),
            )

            # If scheduled_end is set, add a job to auto-finish at that time
            if test.scheduled_end:
                self._scheduler.add_job(
                    self._force_finish,
                    "date",
                    run_date=test.scheduled_end,
                    args=[test_id],
                    id=f"test_{test_id}_end",
                    replace_existing=True,
                )
                logger.info(
                    "Scheduled test #%d end at %s", test_id, test.scheduled_end,
                )

            logger.info(
                "Scheduled test #%d rotations every %d minutes", test_id, interval,
            )
        finally:
            session.close()

    def schedule_delayed_start(self, test_id: int, start_time: datetime) -> None:
        """Schedule a test to start at a future time."""
        self._scheduler.add_job(
            self._delayed_start,
            "date",
            run_date=start_time,
            args=[test_id],
            id=f"test_{test_id}_delayed",
            replace_existing=True,
        )
        logger.info("Scheduled test #%d to start at %s", test_id, start_time)

    def _delayed_start(self, test_id: int) -> None:
        """Called by APScheduler at scheduled_start time."""
        try:
            test = state_machine.start_test(test_id)
            notifier.notify_test_start(test.id, test.video_id, test.video_title)
            self.schedule_test(test_id)
            logger.info("Delayed start: test #%d now running", test_id)
        except Exception as e:
            logger.error("Delayed start failed for test #%d: %s", test_id, e)
            state_machine.set_error(test_id, str(e))
            notifier.notify_error(test_id, str(e))

    def _force_finish(self, test_id: int) -> None:
        """Called at scheduled_end: finish current measurement and determine winner."""
        try:
            session = get_session()
            test = session.get(ABTest, test_id)
            session.close()

            if test.status != TestStatus.RUNNING:
                return

            # End current measurement if any
            measurement_id = self._active_measurements.get(test_id)
            if measurement_id:
                views = youtube_api.get_view_count(test.video_id, test.id)
                state_machine.record_rotation_end(measurement_id, views)

            self._finish_test(test_id)
            logger.info("Test #%d force-finished at scheduled end time", test_id)
        except Exception as e:
            logger.error("Force-finish failed for test #%d: %s", test_id, e)
            state_machine.set_error(test_id, str(e))
            notifier.notify_error(test_id, str(e))

    def _begin_rotation(self, test_id: int) -> None:
        """Set current variant's thumbnail and record start measurement."""
        session = get_session()
        try:
            test = session.get(ABTest, test_id)
            variant = state_machine.get_current_variant(test)
            if variant is None:
                return

            # Check quota before proceeding
            # thumbnails.set = 50 units + videos.list = 1 unit
            if not youtube_api.check_quota_available(51):
                logger.warning("Quota exhausted, pausing test #%d", test_id)
                state_machine.pause_test(test_id)
                notifier.notify_error(test_id, "API quota exhausted. Test paused.")
                self._remove_job(test_id)
                return

            # Set thumbnail
            youtube_api.set_thumbnail(test.video_id, variant.image_path, test.id)

            # Get current view count
            views = youtube_api.get_view_count(test.video_id, test.id)

            # Record measurement start
            measurement = state_machine.record_rotation_start(
                test_id, variant.id, views
            )
            self._active_measurements[test_id] = measurement.id

            # Notify
            notifier.notify_rotation(
                test_id, variant.label, test.current_cycle, views
            )
        except Exception as e:
            logger.error("Failed to begin rotation for test #%d: %s", test_id, e)
            state_machine.set_error(test_id, str(e))
            notifier.notify_error(test_id, str(e))
            self._remove_job(test_id)
        finally:
            session.close()

    def _rotate(self, test_id: int) -> None:
        """Called by APScheduler: end current rotation, advance, begin next."""
        try:
            session = get_session()
            test = session.get(ABTest, test_id)
            session.close()

            if test.status != TestStatus.RUNNING:
                self._remove_job(test_id)
                return

            # End current rotation measurement
            measurement_id = self._active_measurements.get(test_id)
            prev_velocity = None
            prev_label = None
            if measurement_id:
                views = youtube_api.get_view_count(test.video_id, test.id)
                m = state_machine.record_rotation_end(measurement_id, views)
                prev_velocity = m.velocity

                session = get_session()
                from app.models import Variant
                v = session.get(Variant, m.variant_id)
                prev_label = v.label
                session.close()

            # Advance to next variant/cycle
            cycle_complete, test_complete = state_machine.advance_rotation(test_id)

            if test_complete:
                self._finish_test(test_id)
                return

            if cycle_complete:
                logger.info("Test #%d: cycle completed, starting next cycle", test_id)

            # Begin next rotation
            self._begin_rotation(test_id)

        except Exception as e:
            logger.error("Rotation failed for test #%d: %s", test_id, e)
            state_machine.set_error(test_id, str(e))
            notifier.notify_error(test_id, str(e))
            self._remove_job(test_id)

    def _finish_test(self, test_id: int) -> None:
        """Analyze results, set winner thumbnail, notify. Handle multi-day."""
        try:
            # Check multi-day: if not last day, daily_pause and schedule next
            session = get_session()
            test = session.get(ABTest, test_id)
            session.close()

            if test.test_mode == "multi_day" and (test.current_day_index or 0) + 1 < (test.total_days or 1):
                # Not the last day — daily pause and schedule next day
                state_machine.daily_pause_test(test_id)
                self._remove_job(test_id)
                self._schedule_next_day(test_id)
                return

            # Final day or single test — determine winner
            result = analyzer.determine_winner(test_id)
            winner = result.winner

            # Set winner thumbnail permanently
            session = get_session()
            test = session.get(ABTest, test_id)
            variant = session.get(Variant, winner.variant_id)
            session.close()

            youtube_api.set_thumbnail(test.video_id, variant.image_path, test.id)
            state_machine.complete_test(test_id, winner.variant_id)

            msg = analyzer.format_result_message(result)
            notifier.notify_complete(test_id, msg)
            logger.info("Test #%d finished. Winner: %s", test_id, winner.label)

            # Schedule degradation tracking (Feature 4)
            if test.degradation_tracking:
                self._schedule_degradation(test_id)

        except Exception as e:
            logger.error("Failed to finish test #%d: %s", test_id, e)
            state_machine.set_error(test_id, str(e))
            notifier.notify_error(test_id, str(e))
        finally:
            self._remove_job(test_id)

    def _schedule_next_day(self, test_id: int) -> None:
        """Schedule next day for multi-day test."""
        session = get_session()
        try:
            test = session.get(ABTest, test_id)
            days = json.loads(test.scheduled_days) if test.scheduled_days else []
            next_index = (test.current_day_index or 0) + 1
            if next_index >= len(days):
                return

            start_time = test.daily_start_time or "00:00"
            next_dt = datetime.fromisoformat(f"{days[next_index]}T{start_time}:00")

            self._scheduler.add_job(
                self._resume_daily,
                "date",
                run_date=next_dt,
                args=[test_id],
                id=f"test_{test_id}_day{next_index}",
                replace_existing=True,
            )
            logger.info("Scheduled test #%d day %d at %s", test_id, next_index + 1, next_dt)
        finally:
            session.close()

    def _resume_daily(self, test_id: int) -> None:
        """Resume a multi-day test for the next day."""
        try:
            state_machine.advance_day(test_id)
            self.schedule_test(test_id)
            logger.info("Multi-day test #%d resumed for next day", test_id)
        except Exception as e:
            logger.error("Failed to resume daily test #%d: %s", test_id, e)
            state_machine.set_error(test_id, str(e))

    def _schedule_degradation(self, test_id: int) -> None:
        """Schedule 30-day degradation monitoring after test completion."""
        self._scheduler.add_job(
            self._degradation_check,
            "interval",
            hours=24,
            args=[test_id],
            id=f"degradation_{test_id}",
            replace_existing=True,
            next_run_time=datetime.utcnow() + timedelta(hours=24),
        )
        logger.info("Scheduled degradation tracking for test #%d", test_id)

    def _degradation_check(self, test_id: int) -> None:
        """Daily degradation check for completed test."""
        session = get_session()
        try:
            test = session.get(ABTest, test_id)
            if not test or not test.degradation_tracking:
                self._remove_degradation_job(test_id)
                return

            # Count existing checks
            existing = (
                session.query(DegradationCheck)
                .filter_by(ab_test_id=test_id)
                .count()
            )
            day_number = existing + 1

            if day_number > 30:
                self._remove_degradation_job(test_id)
                return

            # Get current view count
            try:
                views = youtube_api.get_view_count(test.video_id, test.id)
            except Exception as e:
                logger.warning("Degradation check view count failed for test #%d: %s", test_id, e)
                return

            # Calculate daily views
            prev_check = (
                session.query(DegradationCheck)
                .filter_by(ab_test_id=test_id)
                .order_by(DegradationCheck.day_number.desc())
                .first()
            )
            daily_views = views - prev_check.view_count if prev_check else 0
            velocity_24h = daily_views / 24.0 if daily_views > 0 else 0.0

            check = DegradationCheck(
                ab_test_id=test_id,
                day_number=day_number,
                view_count=views,
                daily_views=daily_views,
                velocity_24h=velocity_24h,
            )
            session.add(check)

            # Check for 3-day consecutive degradation
            if day_number >= 3:
                recent = (
                    session.query(DegradationCheck)
                    .filter_by(ab_test_id=test_id)
                    .order_by(DegradationCheck.day_number.desc())
                    .limit(2)
                    .all()
                )
                # Get avg test velocity
                measurements = (
                    session.query(Measurement)
                    .filter_by(ab_test_id=test_id)
                    .filter(Measurement.velocity.isnot(None))
                    .all()
                )
                avg_test_vel = sum(m.velocity for m in measurements) / len(measurements) if measurements else 0
                threshold = avg_test_vel * 0.5

                all_below = velocity_24h < threshold
                for rc in recent:
                    if rc.velocity_24h >= threshold:
                        all_below = False
                        break

                if all_below and avg_test_vel > 0:
                    test.degradation_alert = f"Performance dropped below 50% for 3 consecutive days (day {day_number})"
                    logger.warning("Degradation alert for test #%d", test_id)

            session.commit()
            logger.info("Degradation check #%d for test #%d: %d daily views, %.1f v/h",
                       day_number, test_id, daily_views, velocity_24h)
        except Exception as e:
            logger.error("Degradation check failed for test #%d: %s", test_id, e)
        finally:
            session.close()

    def _remove_degradation_job(self, test_id: int) -> None:
        try:
            self._scheduler.remove_job(f"degradation_{test_id}")
        except Exception:
            pass

    def _remove_job(self, test_id: int) -> None:
        for suffix in ["", "_end", "_delayed"]:
            try:
                self._scheduler.remove_job(f"test_{test_id}{suffix}")
            except Exception:
                pass
        self._active_measurements.pop(test_id, None)

    def recover_running_tests(self) -> int:
        """Recover tests that were running before a crash. Returns count recovered."""
        running = state_machine.get_running_tests()
        count = 0
        for test in running:
            try:
                logger.info("Recovering test #%d", test.id)

                # Check for incomplete measurements and close them
                session = get_session()
                incomplete = (
                    session.query(Measurement)
                    .filter_by(ab_test_id=test.id)
                    .filter(Measurement.view_count_end.is_(None))
                    .all()
                )
                for m in incomplete:
                    try:
                        views = youtube_api.get_view_count(test.video_id, test.id)
                        state_machine.record_rotation_end(m.id, views)
                        cycle_complete, test_complete = state_machine.advance_rotation(test.id)
                        if test_complete:
                            self._finish_test(test.id)
                            continue
                    except Exception as e:
                        logger.warning("Could not close measurement #%d: %s", m.id, e)
                session.close()

                # Re-schedule
                self.schedule_test(test.id)
                count += 1
            except Exception as e:
                logger.error("Failed to recover test #%d: %s", test.id, e)

        # Recover pending tests with scheduled_start in the future
        session = get_session()
        try:
            pending_scheduled = (
                session.query(ABTest)
                .filter_by(status=TestStatus.PENDING)
                .filter(ABTest.scheduled_start.isnot(None))
                .all()
            )
            now = datetime.utcnow()
            for test in pending_scheduled:
                if test.scheduled_start > now:
                    self.schedule_delayed_start(test.id, test.scheduled_start)
                    count += 1
                    logger.info("Re-scheduled pending test #%d for %s", test.id, test.scheduled_start)
                else:
                    # Start time has passed, start immediately
                    self._delayed_start(test.id)
                    count += 1

            # Recover daily_paused multi-day tests
            daily_paused = (
                session.query(ABTest)
                .filter_by(status=TestStatus.DAILY_PAUSED)
                .all()
            )
            for test in daily_paused:
                try:
                    self._schedule_next_day(test.id)
                    count += 1
                    logger.info("Re-scheduled daily_paused test #%d", test.id)
                except Exception as e:
                    logger.error("Failed to recover daily_paused test #%d: %s", test.id, e)

            # Recover degradation tracking for completed tests
            completed_tracking = (
                session.query(ABTest)
                .filter_by(status=TestStatus.COMPLETED)
                .filter(ABTest.degradation_tracking == 1)
                .all()
            )
            for test in completed_tracking:
                existing = (
                    session.query(DegradationCheck)
                    .filter_by(ab_test_id=test.id)
                    .count()
                )
                if existing < 30:
                    self._schedule_degradation(test.id)
                    logger.info("Re-scheduled degradation for test #%d (day %d)", test.id, existing + 1)
        finally:
            session.close()

        return count


rotation_scheduler = RotationScheduler()
