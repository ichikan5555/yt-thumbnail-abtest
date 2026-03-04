"""Tests for configuration."""

from app.config import Settings


class TestConfig:
    def test_default_values(self):
        s = Settings(
            google_client_id="test",
            google_client_secret="test",
            _env_file=None,
        )
        assert s.rotation_interval_minutes == 30
        assert s.cycles == 2
        assert s.num_variants == 3
        assert s.daily_quota_limit == 10000
        assert s.api_max_retries == 3
        assert s.log_level == "INFO"

    def test_database_url_is_sqlite(self):
        s = Settings(
            google_client_id="test",
            google_client_secret="test",
            _env_file=None,
        )
        assert s.database_url.startswith("sqlite:///")
        assert "abtest.db" in s.database_url
