"""Test template CRUD — save/load test settings as named templates."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.database import get_session
from app.models import User, UserSettings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/templates", tags=["templates"])

PREFIX = "test_template__"
MAX_TEMPLATES = 10


class TemplateIn(BaseModel):
    name: str
    num_patterns: int = 3
    rotation_interval: int = 30
    cycles: int = 1
    metric_weights: dict[str, int] = {}
    test_mode: str = "single"
    daily_start_time: str = ""


class TemplateOut(BaseModel):
    name: str
    num_patterns: int
    rotation_interval: int
    cycles: int
    metric_weights: dict[str, int]
    test_mode: str
    daily_start_time: str


@router.get("", response_model=list[TemplateOut])
def list_templates(user: User = Depends(get_current_user)):
    session = get_session()
    try:
        rows = (
            session.query(UserSettings)
            .filter(UserSettings.user_id == user.id)
            .filter(UserSettings.key.like(f"{PREFIX}%"))
            .all()
        )
        templates = []
        for r in rows:
            try:
                data = json.loads(r.value)
                templates.append(TemplateOut(**data))
            except (json.JSONDecodeError, TypeError, KeyError):
                continue
        return templates
    finally:
        session.close()


@router.post("", response_model=TemplateOut, status_code=201)
def save_template(body: TemplateIn, user: User = Depends(get_current_user)):
    if not body.name.strip():
        raise HTTPException(400, "Template name is required")

    key = PREFIX + body.name.strip()
    session = get_session()
    try:
        # Check limit (only count non-existing key as new)
        existing = session.query(UserSettings).filter_by(user_id=user.id, key=key).first()
        if not existing:
            count = (
                session.query(UserSettings)
                .filter(UserSettings.user_id == user.id)
                .filter(UserSettings.key.like(f"{PREFIX}%"))
                .count()
            )
            if count >= MAX_TEMPLATES:
                raise HTTPException(400, f"Maximum {MAX_TEMPLATES} templates allowed")

        data = body.model_dump()
        data["name"] = body.name.strip()
        value = json.dumps(data, ensure_ascii=False)

        if existing:
            existing.value = value
        else:
            session.add(UserSettings(user_id=user.id, key=key, value=value))
        session.commit()

        return TemplateOut(**data)
    finally:
        session.close()


@router.delete("/{name}")
def delete_template(name: str, user: User = Depends(get_current_user)):
    key = PREFIX + name
    session = get_session()
    try:
        row = session.query(UserSettings).filter_by(user_id=user.id, key=key).first()
        if not row:
            raise HTTPException(404, "Template not found")
        session.delete(row)
        session.commit()
        return {"deleted": name}
    finally:
        session.close()
