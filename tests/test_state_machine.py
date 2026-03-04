"""Tests for state machine lifecycle management."""

import json
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import ABTest, Base, Measurement, TestStatus, Variant


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture
def sm(db_session):
    """State machine with mocked DB session."""
    from app.services.state_machine import StateMachine
    machine = StateMachine()

    # Patch get_session to return our test session
    with patch("app.services.state_machine.get_session", return_value=db_session):
        yield machine


class TestStateMachine:
    def test_create_test(self, sm, db_session):
        test = sm.create_test("video123", ["/tmp/a.jpg", "/tmp/b.jpg", "/tmp/c.jpg"], "My Video")

        assert test.id is not None
        assert test.video_id == "video123"
        assert test.video_title == "My Video"
        assert test.status == TestStatus.PENDING

        variants = db_session.query(Variant).filter_by(ab_test_id=test.id).all()
        assert len(variants) == 3
        assert variants[0].label == "A"
        assert variants[1].label == "B"
        assert variants[2].label == "C"

    def test_start_test(self, sm, db_session):
        test = sm.create_test("v1", ["/tmp/a.jpg", "/tmp/b.jpg", "/tmp/c.jpg"])
        test = sm.start_test(test.id)

        assert test.status == TestStatus.RUNNING
        assert test.started_at is not None
        assert test.current_cycle == 0
        assert test.current_variant_index == 0

        order = json.loads(test.rotation_order)
        assert sorted(order) == ["A", "B", "C"]

    def test_start_test_wrong_status(self, sm):
        test = sm.create_test("v1", ["/tmp/a.jpg", "/tmp/b.jpg", "/tmp/c.jpg"])
        sm.start_test(test.id)

        with pytest.raises(ValueError, match="expected pending"):
            sm.start_test(test.id)

    def test_get_current_variant(self, sm, db_session):
        test = sm.create_test("v1", ["/tmp/a.jpg", "/tmp/b.jpg", "/tmp/c.jpg"])
        test = sm.start_test(test.id)

        variant = sm.get_current_variant(test)
        order = json.loads(test.rotation_order)
        assert variant is not None
        assert variant.label == order[0]

    def test_record_rotation(self, sm, db_session):
        test = sm.create_test("v1", ["/tmp/a.jpg", "/tmp/b.jpg", "/tmp/c.jpg"])
        test = sm.start_test(test.id)
        variant = sm.get_current_variant(test)

        m = sm.record_rotation_start(test.id, variant.id, 1000)
        assert m.view_count_start == 1000
        assert m.view_count_end is None

        m = sm.record_rotation_end(m.id, 1060)
        assert m.view_count_end == 1060
        assert m.velocity is not None
        assert m.velocity > 0

    def test_advance_rotation_within_cycle(self, sm, db_session):
        test = sm.create_test("v1", ["/tmp/a.jpg", "/tmp/b.jpg", "/tmp/c.jpg"])
        sm.start_test(test.id)

        cycle_done, test_done = sm.advance_rotation(test.id)
        assert not cycle_done
        assert not test_done

    def test_advance_rotation_cycle_complete(self, sm, db_session):
        test = sm.create_test("v1", ["/tmp/a.jpg", "/tmp/b.jpg", "/tmp/c.jpg"])
        sm.start_test(test.id)

        # Advance through all 3 variants in cycle 0
        sm.advance_rotation(test.id)  # index 0 -> 1
        sm.advance_rotation(test.id)  # index 1 -> 2
        cycle_done, test_done = sm.advance_rotation(test.id)  # index 2 -> cycle 1

        assert cycle_done
        assert not test_done  # 2 cycles needed, only 1 done

    def test_advance_rotation_test_complete(self, sm, db_session):
        test = sm.create_test("v1", ["/tmp/a.jpg", "/tmp/b.jpg", "/tmp/c.jpg"])
        sm.start_test(test.id)

        # Advance through 2 full cycles (3 variants x 2 cycles = 6 advances)
        for i in range(5):
            sm.advance_rotation(test.id)

        cycle_done, test_done = sm.advance_rotation(test.id)
        assert cycle_done
        assert test_done

    def test_pause_resume(self, sm):
        test = sm.create_test("v1", ["/tmp/a.jpg", "/tmp/b.jpg", "/tmp/c.jpg"])
        sm.start_test(test.id)

        test = sm.pause_test(test.id)
        assert test.status == TestStatus.PAUSED

        test = sm.resume_test(test.id)
        assert test.status == TestStatus.RUNNING

    def test_cancel(self, sm):
        test = sm.create_test("v1", ["/tmp/a.jpg", "/tmp/b.jpg", "/tmp/c.jpg"])
        sm.start_test(test.id)

        test = sm.cancel_test(test.id)
        assert test.status == TestStatus.CANCELLED

    def test_set_error(self, sm):
        test = sm.create_test("v1", ["/tmp/a.jpg", "/tmp/b.jpg", "/tmp/c.jpg"])
        sm.start_test(test.id)

        test = sm.set_error(test.id, "API quota exceeded")
        assert test.status == TestStatus.ERROR
        assert test.error_message == "API quota exceeded"
