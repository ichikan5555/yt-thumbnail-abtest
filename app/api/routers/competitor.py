"""Competitor channel analysis router (Feature 6)."""

import json
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import get_session
from app.models import CompetitorAnalysis

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/competitor", tags=["competitor"])


class AnalyzeRequest(BaseModel):
    channel_id: str


@router.post("/analyze")
def analyze_competitor(req: AnalyzeRequest):
    """Run competitor channel analysis."""
    from app.services.competitor_service import competitor_service
    try:
        result = competitor_service.analyze_channel(req.channel_id)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error("Competitor analysis failed: %s", e)
        raise HTTPException(500, f"Analysis failed: {e}")


@router.get("/history")
def get_history():
    """List past competitor analyses."""
    session = get_session()
    try:
        analyses = (
            session.query(CompetitorAnalysis)
            .order_by(CompetitorAnalysis.id.desc())
            .limit(20)
            .all()
        )
        return [
            {
                "id": a.id,
                "channel_id": a.channel_id,
                "channel_title": a.channel_title,
                "video_count": a.video_count,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in analyses
        ]
    finally:
        session.close()


@router.get("/{analysis_id}")
def get_analysis(analysis_id: int):
    """Get a specific competitor analysis."""
    session = get_session()
    try:
        a = session.get(CompetitorAnalysis, analysis_id)
        if not a:
            raise HTTPException(404, "Analysis not found")
        result = json.loads(a.analysis_result) if a.analysis_result else {}
        result["id"] = a.id
        result["created_at"] = a.created_at.isoformat() if a.created_at else None
        return result
    finally:
        session.close()
