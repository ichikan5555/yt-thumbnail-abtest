"""SSE real-time updates for tests."""

import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException
from starlette.responses import StreamingResponse

from app.database import get_session
from app.models import ABTest, Variant

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("/tests/{test_id}")
async def test_events(test_id: int):
    # Verify test exists
    session = get_session()
    try:
        test = session.get(ABTest, test_id)
        if not test:
            raise HTTPException(404, "Test not found")
    finally:
        session.close()

    return StreamingResponse(
        _event_stream(test_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _event_stream(test_id: int):
    """Poll DB every 5 seconds and yield SSE events on changes."""
    prev_snapshot = None

    while True:
        session = get_session()
        try:
            test = session.get(ABTest, test_id)
            if not test:
                break

            variants = session.query(Variant).filter_by(ab_test_id=test_id).all()

            snapshot = {
                "test_id": test.id,
                "status": test.status.value,
                "current_cycle": test.current_cycle,
                "current_variant_index": test.current_variant_index,
                "variants": [
                    {
                        "id": v.id,
                        "label": v.label,
                        "avg_velocity": round(v.avg_velocity, 2),
                        "measurement_count": v.measurement_count,
                    }
                    for v in variants
                ],
            }
        finally:
            session.close()

        snapshot_json = json.dumps(snapshot, ensure_ascii=False)

        if snapshot_json != prev_snapshot:
            yield f"data: {snapshot_json}\n\n"
            prev_snapshot = snapshot_json

            # Stop streaming when test is terminal
            if snapshot["status"] in ("completed", "cancelled", "error"):
                break

        await asyncio.sleep(5)
