"""Database engine and session management."""

import logging
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.models import Base

logger = logging.getLogger(__name__)

# Ensure data directory exists
db_path = Path(settings.database_url.replace("sqlite:///", ""))
db_path.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.database_url,
    echo=False,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate()


def _migrate() -> None:
    """Add columns that don't exist yet (lightweight migration)."""
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


def get_session() -> Session:
    return SessionLocal()
