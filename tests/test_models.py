"""Tests for database models and operations."""

import json
import os
import tempfile

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models import ABTest, Base, Measurement, Notification, QuotaLog, TestStatus, Variant


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


class TestABTest:
    def test_create_test(self, db_session: Session):
        test = ABTest(video_id="abc123", video_title="Test Video", status=TestStatus.PENDING, cycles=2)
        db_session.add(test)
        db_session.commit()

        assert test.id is not None
        assert test.video_id == "abc123"
        assert test.status == TestStatus.PENDING
        assert test.cycles == 2
        assert test.winner_variant_id is None

    def test_status_transitions(self, db_session: Session):
        test = ABTest(video_id="v1", status=TestStatus.PENDING, cycles=2)
        db_session.add(test)
        db_session.commit()

        test.status = TestStatus.RUNNING
        db_session.commit()
        assert test.status == TestStatus.RUNNING

        test.status = TestStatus.PAUSED
        db_session.commit()
        assert test.status == TestStatus.PAUSED

        test.status = TestStatus.RUNNING
        db_session.commit()

        test.status = TestStatus.COMPLETED
        db_session.commit()
        assert test.status == TestStatus.COMPLETED


class TestVariant:
    def test_create_variants(self, db_session: Session):
        test = ABTest(video_id="v1", status=TestStatus.PENDING, cycles=2)
        db_session.add(test)
        db_session.flush()

        for label, path in [("A", "/tmp/a.jpg"), ("B", "/tmp/b.jpg"), ("C", "/tmp/c.jpg")]:
            v = Variant(ab_test_id=test.id, label=label, image_path=path)
            db_session.add(v)
        db_session.commit()

        variants = db_session.query(Variant).filter_by(ab_test_id=test.id).all()
        assert len(variants) == 3
        assert {v.label for v in variants} == {"A", "B", "C"}

    def test_avg_velocity_no_measurements(self, db_session: Session):
        test = ABTest(video_id="v1", status=TestStatus.PENDING, cycles=2)
        db_session.add(test)
        db_session.flush()

        v = Variant(ab_test_id=test.id, label="A", image_path="/tmp/a.jpg")
        db_session.add(v)
        db_session.commit()

        assert v.avg_velocity == 0.0

    def test_avg_velocity_with_data(self, db_session: Session):
        test = ABTest(video_id="v1", status=TestStatus.PENDING, cycles=2)
        db_session.add(test)
        db_session.flush()

        v = Variant(ab_test_id=test.id, label="A", image_path="/tmp/a.jpg",
                    total_velocity=300.0, measurement_count=2)
        db_session.add(v)
        db_session.commit()

        assert v.avg_velocity == 150.0


class TestMeasurement:
    def test_create_measurement(self, db_session: Session):
        test = ABTest(video_id="v1", status=TestStatus.RUNNING, cycles=2)
        db_session.add(test)
        db_session.flush()

        v = Variant(ab_test_id=test.id, label="A", image_path="/tmp/a.jpg")
        db_session.add(v)
        db_session.flush()

        m = Measurement(
            ab_test_id=test.id, variant_id=v.id,
            cycle=0, view_count_start=1000,
        )
        db_session.add(m)
        db_session.commit()

        assert m.id is not None
        assert m.view_count_end is None
        assert m.velocity is None


class TestQuotaLog:
    def test_quota_tracking(self, db_session: Session):
        log = QuotaLog(date="2026-03-04", operation="thumbnails.set", units=50)
        db_session.add(log)
        db_session.commit()

        assert log.id is not None
        assert log.units == 50


class TestNotification:
    def test_notification_log(self, db_session: Session):
        test = ABTest(video_id="v1", status=TestStatus.RUNNING, cycles=2)
        db_session.add(test)
        db_session.flush()

        n = Notification(
            ab_test_id=test.id, channel="chatwork",
            event="start", message="Test started", success=1,
        )
        db_session.add(n)
        db_session.commit()

        assert n.id is not None
