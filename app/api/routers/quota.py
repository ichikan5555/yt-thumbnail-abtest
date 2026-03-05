"""Quota API."""

from fastapi import APIRouter, Depends

from app.config import settings
from app.api.schemas import QuotaOut
from app.api.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/api/quota", tags=["quota"])


@router.get("", response_model=QuotaOut)
def get_quota(user: User = Depends(get_current_user)):
    from app.services.youtube_api import youtube_api

    used = youtube_api.get_daily_quota_used(user_id=user.id)
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
