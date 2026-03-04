"""User settings API."""

import json
import logging

from fastapi import APIRouter

from app.api.schemas import SettingsOut, SettingsUpdate
from app.database import get_session
from app.models import UserSettings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])

# All setting keys with their defaults
DEFAULTS: dict[str, str] = {
    "default_rotation_interval": "30",
    "default_cycles": "1",
    "default_num_patterns": "3",
    "default_start_time": "",
    "default_metric_weights": "{}",
    "notification_channels": '["chatwork","email","slack"]',
}


def _get_all_settings() -> dict[str, str]:
    """Load all settings from DB, merged with defaults."""
    session = get_session()
    try:
        rows = session.query(UserSettings).all()
        db_vals = {r.key: r.value for r in rows}
        return {k: db_vals.get(k, v) for k, v in DEFAULTS.items()}
    finally:
        session.close()


def _to_settings_out(raw: dict[str, str]) -> SettingsOut:
    weights = json.loads(raw.get("default_metric_weights", "{}"))
    channels = json.loads(raw.get("notification_channels", '["chatwork","email","slack"]'))
    return SettingsOut(
        default_rotation_interval=int(raw.get("default_rotation_interval", "30")),
        default_cycles=int(raw.get("default_cycles", "1")),
        default_num_patterns=int(raw.get("default_num_patterns", "3")),
        default_start_time=raw.get("default_start_time", ""),
        default_metric_weights=weights,
        notification_channels=channels,
    )


@router.get("", response_model=SettingsOut)
def get_settings():
    raw = _get_all_settings()
    return _to_settings_out(raw)


@router.put("", response_model=SettingsOut)
def update_settings(body: SettingsUpdate):
    session = get_session()
    try:
        updates: dict[str, str] = {}
        if body.default_rotation_interval is not None:
            updates["default_rotation_interval"] = str(body.default_rotation_interval)
        if body.default_cycles is not None:
            updates["default_cycles"] = str(body.default_cycles)
        if body.default_num_patterns is not None:
            updates["default_num_patterns"] = str(body.default_num_patterns)
        if body.default_start_time is not None:
            updates["default_start_time"] = body.default_start_time
        if body.default_metric_weights is not None:
            updates["default_metric_weights"] = json.dumps(body.default_metric_weights)
        if body.notification_channels is not None:
            updates["notification_channels"] = json.dumps(body.notification_channels)

        for key, value in updates.items():
            row = session.query(UserSettings).filter_by(key=key).first()
            if row:
                row.value = value
            else:
                session.add(UserSettings(key=key, value=value))
        session.commit()

        raw = {r.key: r.value for r in session.query(UserSettings).all()}
        merged = {k: raw.get(k, v) for k, v in DEFAULTS.items()}
        return _to_settings_out(merged)
    finally:
        session.close()


def get_setting_value(key: str) -> str | None:
    """Helper to get a single setting value (used by other modules)."""
    session = get_session()
    try:
        row = session.query(UserSettings).filter_by(key=key).first()
        if row:
            return row.value
        return DEFAULTS.get(key)
    finally:
        session.close()
