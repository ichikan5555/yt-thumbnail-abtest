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
    ]
    with engine.begin() as conn:
        for col_name, col_type in migrations:
            if col_name not in existing:
                conn.execute(text(
                    f"ALTER TABLE ab_tests ADD COLUMN {col_name} {col_type}"
                ))
                logger.info("Migration: added ab_tests.%s", col_name)


def get_session() -> Session:
    return SessionLocal()
