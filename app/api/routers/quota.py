"""Quota API."""

from fastapi import APIRouter

from app.config import settings
from app.api.schemas import QuotaOut

router = APIRouter(prefix="/api/quota", tags=["quota"])


@router.get("", response_model=QuotaOut)
def get_quota():
    from app.services.youtube_api import youtube_api

    used = youtube_api.get_daily_quota_used()
    limit = settings.daily_quota_limit
    remaining = limit - used
    pct = used / limit * 100 if limit > 0 else 0

    return QuotaOut(
        used=used,
        limit=limit,
        remaining=remaining,
        pct=round(pct, 1),
        est_tests_possible=remaining // 357 if remaining > 0 else 0,
    )
