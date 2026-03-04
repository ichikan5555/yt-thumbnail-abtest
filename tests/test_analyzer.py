"""Tests for analyzer / winner determination."""

from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import ABTest, Base, Measurement, TestStatus, Variant
from app.services.analyzer import Analyzer, TestResult


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture
def test_with_data(db_session):
    """Create a test with 3 variants and measurements."""
    test = ABTest(video_id="v1", video_title="Test Video", status=TestStatus.RUNNING, cycles=2)
    db_session.add(test)
    db_session.flush()

    # Variant A: avg 120 views/h
    va = Variant(ab_test_id=test.id, label="A", image_path="/tmp/a.jpg",
                 total_velocity=240.0, measurement_count=2)
    # Variant B: avg 185 views/h (winner)
    vb = Variant(ab_test_id=test.id, label="B", image_path="/tmp/b.jpg",
                 total_velocity=370.0, measurement_count=2)
    # Variant C: avg 98 views/h
    vc = Variant(ab_test_id=test.id, label="C", image_path="/tmp/c.jpg",
                 total_velocity=196.0, measurement_count=2)
    db_session.add_all([va, vb, vc])
    db_session.flush()

    # Add measurements for each variant
    from datetime import datetime, timedelta
    now = datetime.utcnow()

    for variant, velocities in [(va, [110, 130]), (vb, [180, 190]), (vc, [95, 101])]:
        for i, vel in enumerate(velocities):
            start = 1000 + i * 100
            end = start + int(vel * 0.5)  # 30 min = 0.5 hour
            m = Measurement(
                ab_test_id=test.id, variant_id=variant.id, cycle=i,
                view_count_start=start, view_count_end=end,
                started_at=now - timedelta(hours=2 - i),
                ended_at=now - timedelta(hours=1.5 - i),
                duration_minutes=30.0, velocity=vel,
            )
            db_session.add(m)

    db_session.commit()
    return test


class TestAnalyzer:
    def test_determine_winner(self, db_session, test_with_data):
        analyzer = Analyzer()
        with patch("app.services.analyzer.get_session", return_value=db_session):
            result = analyzer.determine_winner(test_with_data.id)

        assert result.winner.label == "B"
        assert result.winner.is_winner is True
        assert result.winner.avg_velocity == 185.0

        labels = [v.label for v in result.variants]
        assert labels[0] == "B"  # Highest velocity first

        # C should have 0% improvement (it's the worst)
        c_result = next(v for v in result.variants if v.label == "C")
        assert c_result.improvement_pct == 0.0

        # B should have positive improvement
        assert result.winner.improvement_pct > 0

    def test_format_result_message(self, db_session, test_with_data):
        analyzer = Analyzer()
        with patch("app.services.analyzer.get_session", return_value=db_session):
            result = analyzer.determine_winner(test_with_data.id)
            msg = analyzer.format_result_message(result)

        assert "勝者: B" in msg
        assert "Test Video" in msg
        assert "views/h" in msg
        assert "固定設定" in msg

    def test_all_variants_have_results(self, db_session, test_with_data):
        analyzer = Analyzer()
        with patch("app.services.analyzer.get_session", return_value=db_session):
            result = analyzer.determine_winner(test_with_data.id)

        assert len(result.variants) == 3
        for v in result.variants:
            assert v.measurement_count == 2
            assert v.avg_velocity > 0
