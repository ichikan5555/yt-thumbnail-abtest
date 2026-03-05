"""Database engine and session management."""

import logging
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.models import Base

logger = logging.getLogger(__name__)

_is_sqlite = settings.database_url.startswith("sqlite")

# Ensure data directory exists (SQLite only)
if _is_sqlite:
    db_path = Path(settings.database_url.replace("sqlite:///", ""))
    db_path.parent.mkdir(parents=True, exist_ok=True)

_connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_engine(
    settings.database_url,
    echo=False,
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate()


def _migrate() -> None:
    """Add columns that don't exist yet (lightweight migration, SQLite only)."""
    if not _is_sqlite:
        return
    insp = inspect(engine)
    if not insp.has_table("ab_tests"):
        return
    existing = {c["name"] for c in insp.get_columns("ab_tests")}
    migrations = [
        ("rotation_interval", "INTEGER DEFAULT 30"),
        ("scheduled_start", "DATETIME"),
        ("scheduled_end", "DATETIME"),
        ("metric_weights", "TEXT DEFAULT ''"),
        ("analytics_fetched_at", "DATETIME"),
        # Feature 3: Multi-day
        ("test_mode", "VARCHAR(20) DEFAULT 'single'"),
        ("scheduled_days", "TEXT DEFAULT ''"),
        ("daily_start_time", "VARCHAR(5) DEFAULT ''"),
        ("current_day_index", "INTEGER DEFAULT 0"),
        ("total_days", "INTEGER DEFAULT 1"),
        # Feature 4: Degradation
        ("degradation_tracking", "INTEGER DEFAULT 1"),
        ("degradation_alert", "TEXT"),
    ]
    with engine.begin() as conn:
        for col_name, col_type in migrations:
            if col_name not in existing:
                conn.execute(text(
                    f"ALTER TABLE ab_tests ADD COLUMN {col_name} {col_type}"
                ))
                logger.info("Migration: added ab_tests.%s", col_name)

    # Variant columns (Feature 5)
    if insp.has_table("variants"):
        v_existing = {c["name"] for c in insp.get_columns("variants")}
        v_migrations = [
            ("thumbnail_categories", "TEXT DEFAULT ''"),
            ("categories_analyzed_at", "DATETIME"),
        ]
        with engine.begin() as conn:
            for col_name, col_type in v_migrations:
                if col_name not in v_existing:
                    conn.execute(text(
                        f"ALTER TABLE variants ADD COLUMN {col_name} {col_type}"
                    ))
                    logger.info("Migration: added variants.%s", col_name)

    # Multi-tenant: ab_tests.user_id
    if "user_id" not in existing:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE ab_tests ADD COLUMN user_id INTEGER"))
            logger.info("Migration: added ab_tests.user_id")

    # Multi-tenant: quota_log.user_id
    if insp.has_table("quota_log"):
        ql_existing = {c["name"] for c in insp.get_columns("quota_log")}
        if "user_id" not in ql_existing:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE quota_log ADD COLUMN user_id INTEGER"))
                logger.info("Migration: added quota_log.user_id")

    # Multi-tenant: competitor_analyses.user_id
    if insp.has_table("competitor_analyses"):
        ca_existing = {c["name"] for c in insp.get_columns("competitor_analyses")}
        if "user_id" not in ca_existing:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE competitor_analyses ADD COLUMN user_id INTEGER"))
                logger.info("Migration: added competitor_analyses.user_id")

    # User YouTube OAuth2 columns
    if insp.has_table("users"):
        u_existing = {c["name"] for c in insp.get_columns("users")}
        u_migrations = [
            ("chatwork_api_token", "VARCHAR(255)"),
            ("youtube_client_id", "VARCHAR(255)"),
            ("youtube_client_secret", "VARCHAR(255)"),
            ("youtube_token", "TEXT"),
            ("youtube_connected_at", "DATETIME"),
            ("youtube_channel_title", "VARCHAR(255) DEFAULT ''"),
        ]
        with engine.begin() as conn:
            for col_name, col_type in u_migrations:
                if col_name not in u_existing:
                    conn.execute(text(
                        f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"
                    ))
                    logger.info("Migration: added users.%s", col_name)

    # Multi-tenant: user_settings — add user_id + recreate unique constraint
    if insp.has_table("user_settings"):
        us_existing = {c["name"] for c in insp.get_columns("user_settings")}
        if "user_id" not in us_existing:
            with engine.begin() as conn:
                # SQLite doesn't support DROP CONSTRAINT, so recreate the table
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS user_settings_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        key VARCHAR(100) NOT NULL,
                        value TEXT DEFAULT '',
                        updated_at DATETIME
                    )
                """))
                conn.execute(text("""
                    INSERT INTO user_settings_new (id, user_id, key, value, updated_at)
                    SELECT id, NULL, key, value, updated_at FROM user_settings
                """))
                conn.execute(text("DROP TABLE user_settings"))
                conn.execute(text("ALTER TABLE user_settings_new RENAME TO user_settings"))
                conn.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_user_settings_user_key ON user_settings (user_id, key)"
                ))
                conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_user_settings_key ON user_settings (key)"
                ))
                logger.info("Migration: recreated user_settings with user_id + unique(user_id, key)")


def get_session() -> Session:
    return SessionLocal()
