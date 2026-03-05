"""Cross-test analysis router (Feature 5)."""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user, verify_test_ownership
from app.database import get_session
from app.models import ABTest, User, Variant, TestStatus
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/cross-analysis", tags=["cross-analysis"])


@router.get("")
def get_cross_analysis(user: User = Depends(get_current_user)):
    """Aggregate category stats across user's completed tests."""
    session = get_session()
    try:
        completed_tests = (
            session.query(ABTest)
            .filter_by(status=TestStatus.COMPLETED, user_id=user.id)
            .all()
        )

        category_stats: dict[str, dict] = {}
        # category -> { count, wins, total_score, scores[] }

        for test in completed_tests:
            variants = session.query(Variant).filter_by(ab_test_id=test.id).all()
            winner_id = test.winner_variant_id

            for v in variants:
                if not v.thumbnail_categories:
                    continue
                try:
                    cats = json.loads(v.thumbnail_categories)
                except (json.JSONDecodeError, TypeError):
                    continue

                is_winner = v.id == winner_id
                score = v.avg_velocity

                for cat in cats:
                    if cat not in category_stats:
                        category_stats[cat] = {
                            "count": 0,
                            "wins": 0,
                            "total_score": 0.0,
                        }
                    category_stats[cat]["count"] += 1
                    category_stats[cat]["total_score"] += score
                    if is_winner:
                        category_stats[cat]["wins"] += 1

        # Build response
        categories = []
        for cat, stats in sorted(category_stats.items(), key=lambda x: x[1]["wins"], reverse=True):
            win_rate = stats["wins"] / stats["count"] * 100 if stats["count"] > 0 else 0
            avg_score = stats["total_score"] / stats["count"] if stats["count"] > 0 else 0
            categories.append({
                "category": cat,
                "count": stats["count"],
                "wins": stats["wins"],
                "win_rate": round(win_rate, 1),
                "avg_score": round(avg_score, 1),
            })

        return {
            "total_tests": len(completed_tests),
            "categories": categories,
        }
    finally:
        session.close()


@router.post("/classify/{test_id}")
def classify_test_thumbnails(test_id: int, user: User = Depends(get_current_user)):
    """Classify all thumbnails for a test using Gemini Vision."""
    session = get_session()
    try:
        verify_test_ownership(test_id, user.id, session)

        variants = session.query(Variant).filter_by(ab_test_id=test_id).all()
        results = []

        for v in variants:
            categories = gemini_service.classify_thumbnail(v.image_path)
            v.thumbnail_categories = json.dumps(categories)
            v.categories_analyzed_at = datetime.utcnow()
            results.append({
                "variant_id": v.id,
                "label": v.label,
                "categories": categories,
            })

        session.commit()
        return {"test_id": test_id, "variants": results}
    finally:
        session.close()
