"""Application configuration via environment variables."""

from pathlib import Path

from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # YouTube OAuth2
    google_client_id: str = ""
    google_client_secret: str = ""
    token_path: Path = BASE_DIR / "credentials" / "token.json"

    # Database
    database_url: str = f"sqlite:///{BASE_DIR / 'data' / 'abtest.db'}"

    # Test parameters
    rotation_interval_minutes: int = 30
    cycles: int = 2
    num_variants: int = 3  # A/B/C

    # API retry
    api_max_retries: int = 3
    api_retry_base_delay: float = 2.0

    # YouTube API quota
    daily_quota_limit: int = 10000

    # Chatwork
    chatwork_api_token: str = ""
    chatwork_room_id: str = ""

    # SendGrid
    sendgrid_api_key: str = ""
    email_from: str = ""
    email_to: str = ""

    # Slack
    slack_webhook_url: str = ""

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_expire_days: int = 7
    chatwork_auth_token: str = ""  # separate token for 2FA (personal token)
    chatwork_auth_room_id: str = ""  # room for 2FA codes

    # Gemini AI (Feature 5/6)
    gemini_api_key: str = ""

    # Web UI
    web_host: str = "0.0.0.0"
    web_port: int = 8888
    thumbnail_upload_dir: Path = BASE_DIR / "data" / "thumbnails"
    base_url: str = "http://localhost:8888"
    cors_origins: str = "http://localhost:5173"

    # Logging
    log_level: str = "INFO"

    model_config = {"env_file": str(BASE_DIR / ".env"), "env_file_encoding": "utf-8"}


settings = Settings()
