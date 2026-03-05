"""Test CRUD and operations API."""

import json
import logging
import math
import shutil
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form

from app.config import settings
from app.database import get_session
from app.models import ABTest, DegradationCheck, Measurement, TestStatus, User, Variant
from app.api.deps import get_current_user, verify_test_ownership
from app.api.schemas import (
    DegradationCheckOut,
    DegradationOut,
    HeatmapCell,
    HeatmapOut,
    MeasurementOut,
    SignificanceOut,
    TestDetail,
    TestResultOut,
    TestSummary,
    VariantHeatmap,
    VariantOut,
    VariantResultOut,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tests", tags=["tests"])


def _variant_out(v: Variant) -> VariantOut:
    thumb_url = None
    upload_dir = settings.thumbnail_upload_dir
    if v.image_path and Path(v.image_path).is_relative_to(upload_dir):
        thumb_url = f"/thumbnails/{Path(v.image_path).name}"
    return VariantOut(
        id=v.id,
        label=v.label,
        image_path=v.image_path,
        thumbnail_url=thumb_url,
        avg_velocity=v.avg_velocity,
        measurement_count=v.measurement_count,
    )


def _measurement_out(m: Measurement, session) -> MeasurementOut:
    v = session.get(Variant, m.variant_id)
    return MeasurementOut(
        id=m.id,
        variant_id=m.variant_id,
        variant_label=v.label if v else None,
        cycle=m.cycle,
        view_count_start=m.view_count_start,
        view_count_end=m.view_count_end,
        started_at=m.started_at,
        ended_at=m.ended_at,
        duration_minutes=m.duration_minutes,
        velocity=m.velocity,
    )


@router.get("", response_model=list[TestSummary])
def list_tests(user: User = Depends(get_current_user)):
    session = get_session()
    try:
        tests = session.query(ABTest).filter_by(user_id=user.id).order_by(ABTest.id.desc()).limit(50).all()
        result = []
        for t in tests:
            winner_label = None
            if t.winner_variant_id:
                w = session.get(Variant, t.winner_variant_id)
                winner_label = w.label if w else None
            result.append(TestSummary(
                id=t.id,
                video_id=t.video_id,
                video_title=t.video_title or "",
                status=t.status.value,
                current_cycle=t.current_cycle,
                cycles=t.cycles,
                rotation_interval=t.rotation_interval or 30,
                scheduled_start=t.scheduled_start,
                scheduled_end=t.scheduled_end,
                winner_label=winner_label,
                created_at=t.created_at,
                started_at=t.started_at,
                completed_at=t.completed_at,
                test_mode=t.test_mode or "single",
                current_day_index=t.current_day_index or 0,
                total_days=t.total_days or 1,
            ))
        return result
    finally:
        session.close()


@router.post("", response_model=TestDetail, status_code=201)
async def create_test(
    video_id: str = Form(...),
    thumbnail_a: UploadFile = File(...),
    thumbnail_b: UploadFile = File(...),
    thumbnail_c: UploadFile | None = File(default=None),
    thumbnail_d: UploadFile | None = File(default=None),
    rotation_interval: int = Form(default=30),
    scheduled_start: str = Form(default=""),
    scheduled_end: str = Form(default=""),
    metric_weights: str = Form(default=""),
    test_mode: str = Form(default="single"),
    scheduled_days: str = Form(default=""),
    daily_start_time: str = Form(default=""),
    user: User = Depends(get_current_user),
):
    from app.services.youtube_api import youtube_api
    from app.services.state_machine import state_machine
    from app.services.notifier import notifier
    from app.services.scheduler import rotation_scheduler

    # Build upload list (2-4 patterns)
    uploads: list[tuple[str, UploadFile]] = [("A", thumbnail_a), ("B", thumbnail_b)]
    if thumbnail_c is not None:
        uploads.append(("C", thumbnail_c))
    if thumbnail_d is not None:
        uploads.append(("D", thumbnail_d))
    num_variants = len(uploads)

    # Parse schedule times
    sched_start_dt: datetime | None = None
    sched_end_dt: datetime | None = None
    if scheduled_start:
        sched_start_dt = datetime.fromisoformat(scheduled_start)
    if scheduled_end:
        sched_end_dt = datetime.fromisoformat(scheduled_end)

    # Load DB defaults as fallback
    from app.api.routers.settings import get_setting_value
    db_cycles = int(get_setting_value("default_cycles", user_id=user.id) or settings.cycles)

    # Calculate cycles from schedule if end time is given
    interval = max(rotation_interval, 5)  # minimum 5 min
    if sched_start_dt and sched_end_dt:
        total_minutes = (sched_end_dt - sched_start_dt).total_seconds() / 60
        if total_minutes < interval * num_variants:
            raise HTTPException(400, "End time too close to start. Need at least 1 full cycle.")
        cycles = max(1, int(total_minutes / (interval * num_variants)))
    else:
        cycles = db_cycles

    # Check quota
    estimated_quota = (cycles * num_variants + 1) * 51
    if not youtube_api.check_quota_available(estimated_quota):
        raise HTTPException(400, f"Insufficient API quota. Need ~{estimated_quota} units.")

    # Save uploaded thumbnails
    upload_dir = settings.thumbnail_upload_dir
    upload_dir.mkdir(parents=True, exist_ok=True)

    image_paths: list[str] = []
    for label, file in uploads:
        ext = Path(file.filename).suffix if file.filename else ".jpg"
        filename = f"{video_id}_{label}{ext}"
        dest = upload_dir / filename
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        image_paths.append(str(dest.resolve()))

    # Get video info
    try:
        info = youtube_api.get_video_info(video_id)
    except Exception as e:
        raise HTTPException(400, f"Failed to fetch video info: {e}")

    # Parse multi-day params
    days_list = []
    total_days = 1
    if test_mode == "multi_day" and scheduled_days:
        try:
            days_list = json.loads(scheduled_days)
            total_days = len(days_list)
        except (json.JSONDecodeError, TypeError):
            raise HTTPException(400, "Invalid scheduled_days format")
        if total_days < 1 or total_days > 7:
            raise HTTPException(400, "Multi-day tests support 1-7 days")

    # Create test with schedule params
    test = state_machine.create_test(
        video_id, image_paths, info["title"],
        rotation_interval=interval,
        cycles=cycles,
        scheduled_start=sched_start_dt,
        scheduled_end=sched_end_dt,
        metric_weights=metric_weights if metric_weights else None,
        test_mode=test_mode,
        scheduled_days=scheduled_days if test_mode == "multi_day" else "",
        daily_start_time=daily_start_time if test_mode == "multi_day" else "",
        total_days=total_days,
        user_id=user.id,
    )

    now = datetime.utcnow()
    if test_mode == "multi_day" and days_list:
        # Multi-day: schedule first day
        from datetime import date as date_type
        first_day = days_list[0]
        start_time = daily_start_time or "00:00"
        first_dt = datetime.fromisoformat(f"{first_day}T{start_time}:00")
        if first_dt > now:
            rotation_scheduler.schedule_delayed_start(test.id, first_dt)
        else:
            test = state_machine.start_test(test.id)
            notifier.notify_test_start(test.id, video_id, info["title"])
            rotation_scheduler.schedule_test(test.id)
    elif sched_start_dt and sched_start_dt > now:
        # Future start: schedule delayed start
        rotation_scheduler.schedule_delayed_start(test.id, sched_start_dt)
        logger.info("Test #%d scheduled to start at %s", test.id, sched_start_dt)
    else:
        # Start immediately
        test = state_machine.start_test(test.id)
        notifier.notify_test_start(test.id, video_id, info["title"])
        rotation_scheduler.schedule_test(test.id)

    return _get_test_detail(test.id)


@router.get("/{test_id}", response_model=TestDetail)
def get_test(test_id: int, user: User = Depends(get_current_user)):
    session = get_session()
    try:
        verify_test_ownership(test_id, user.id, session)
    finally:
        session.close()
    return _get_test_detail(test_id)


@router.get("/{test_id}/results", response_model=TestResultOut)
def get_results(test_id: int, user: User = Depends(get_current_user)):
    session = get_session()
    try:
        verify_test_ownership(test_id, user.id, session)
    finally:
        session.close()

    from app.services.analyzer import analyzer
    from app.api.schemas import MetricScoreOut
    result = analyzer.determine_winner(test_id)

    def _variant_result(v):
        return VariantResultOut(
            variant_id=v.variant_id,
            label=v.label,
            avg_velocity=v.avg_velocity,
            measurement_count=v.measurement_count,
            total_views_gained=v.total_views_gained,
            composite_score=v.composite_score,
            is_winner=v.is_winner,
            improvement_pct=v.improvement_pct,
            metrics={
                k: MetricScoreOut(
                    raw_value=ms.raw_value,
                    normalized=ms.normalized,
                    weighted=ms.weighted,
                )
                for k, ms in v.metrics.items()
            },
        )

    return TestResultOut(
        test_id=result.test_id,
        video_id=result.video_id,
        video_title=result.video_title,
        winner=_variant_result(result.winner),
        variants=[_variant_result(v) for v in result.variants],
        weights=result.weights,
        has_analytics=result.has_analytics,
    )


@router.post("/{test_id}/fetch-analytics")
def fetch_analytics(test_id: int, user: User = Depends(get_current_user)):
    """Fetch YouTube Analytics data for a test (may have 1-2 day delay)."""
    session = get_session()
    try:
        verify_test_ownership(test_id, user.id, session)
    finally:
        session.close()
    from app.services.youtube_analytics import youtube_analytics
    try:
        data = youtube_analytics.fetch_and_store(test_id)
        return {"status": "ok", "variants": data}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/{test_id}/pause", response_model=TestDetail)
def pause_test(test_id: int, user: User = Depends(get_current_user)):
    session = get_session()
    try:
        verify_test_ownership(test_id, user.id, session)
    finally:
        session.close()
    from app.services.state_machine import state_machine
    try:
        state_machine.pause_test(test_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return _get_test_detail(test_id)


@router.post("/{test_id}/resume", response_model=TestDetail)
def resume_test(test_id: int, user: User = Depends(get_current_user)):
    session = get_session()
    try:
        verify_test_ownership(test_id, user.id, session)
    finally:
        session.close()
    from app.services.state_machine import state_machine
    from app.services.scheduler import rotation_scheduler
    try:
        state_machine.resume_test(test_id)
        rotation_scheduler.schedule_test(test_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return _get_test_detail(test_id)


@router.post("/{test_id}/cancel", response_model=TestDetail)
def cancel_test(test_id: int, user: User = Depends(get_current_user)):
    session = get_session()
    try:
        verify_test_ownership(test_id, user.id, session)
    finally:
        session.close()
    from app.services.state_machine import state_machine
    try:
        state_machine.cancel_test(test_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return _get_test_detail(test_id)


# --- Feature 1: Heatmap ---

@router.get("/{test_id}/heatmap", response_model=HeatmapOut)
def get_heatmap(test_id: int, user: User = Depends(get_current_user)):
    """Get time-of-day heatmap data for a test."""
    session = get_session()
    try:
        verify_test_ownership(test_id, user.id, session)

        variants = session.query(Variant).filter_by(ab_test_id=test_id).all()
        variant_map = {v.id: v.label for v in variants}

        measurements = (
            session.query(Measurement)
            .filter_by(ab_test_id=test_id)
            .filter(Measurement.velocity.isnot(None))
            .all()
        )

        # Group by variant label -> (weekday, hour) -> velocities
        data: dict[str, dict[tuple[int, int], list[float]]] = defaultdict(lambda: defaultdict(list))
        for m in measurements:
            if m.started_at and m.variant_id in variant_map:
                label = variant_map[m.variant_id]
                wd = m.started_at.weekday()  # 0=Mon
                hr = m.started_at.hour
                data[label][(wd, hr)].append(m.velocity)

        variant_heatmaps = []
        for label in sorted(data.keys()):
            cells = []
            for (wd, hr), velocities in sorted(data[label].items()):
                avg = sum(velocities) / len(velocities)
                cells.append(HeatmapCell(weekday=wd, hour=hr, avg_velocity=round(avg, 1)))
            variant_heatmaps.append(VariantHeatmap(label=label, cells=cells))

        return HeatmapOut(test_id=test_id, variants=variant_heatmaps)
    finally:
        session.close()


# --- Feature 2: Significance ---

@router.get("/{test_id}/significance", response_model=SignificanceOut)
def get_significance(test_id: int, user: User = Depends(get_current_user)):
    """Get statistical significance analysis."""
    session = get_session()
    try:
        verify_test_ownership(test_id, user.id, session)
    finally:
        session.close()

    from app.services.statistics import compute_significance
    result = compute_significance(test_id)
    return SignificanceOut(**result)


# --- Feature 4: Degradation ---

@router.get("/{test_id}/degradation", response_model=DegradationOut)
def get_degradation(test_id: int, user: User = Depends(get_current_user)):
    """Get degradation tracking data for a completed test."""
    session = get_session()
    try:
        verify_test_ownership(test_id, user.id, session)

        checks = (
            session.query(DegradationCheck)
            .filter_by(ab_test_id=test_id)
            .order_by(DegradationCheck.day_number)
            .all()
        )

        # Calculate avg test velocity
        measurements = (
            session.query(Measurement)
            .filter_by(ab_test_id=test_id)
            .filter(Measurement.velocity.isnot(None))
            .all()
        )
        avg_test_velocity = 0.0
        if measurements:
            avg_test_velocity = sum(m.velocity for m in measurements) / len(measurements)

        return DegradationOut(
            test_id=test_id,
            tracking_enabled=bool(test.degradation_tracking),
            alert=test.degradation_alert,
            avg_test_velocity=round(avg_test_velocity, 1),
            checks=[
                DegradationCheckOut(
                    day_number=c.day_number,
                    view_count=c.view_count,
                    daily_views=c.daily_views,
                    velocity_24h=c.velocity_24h,
                    checked_at=c.checked_at,
                )
                for c in checks
            ],
        )
    finally:
        session.close()


@router.post("/{test_id}/degradation/toggle")
def toggle_degradation(test_id: int, user: User = Depends(get_current_user)):
    """Toggle degradation tracking on/off."""
    session = get_session()
    try:
        verify_test_ownership(test_id, user.id, session)
        test.degradation_tracking = 0 if test.degradation_tracking else 1
        session.commit()
        return {"tracking_enabled": bool(test.degradation_tracking)}
    finally:
        session.close()


def _get_test_detail(test_id: int) -> TestDetail:
    session = get_session()
    try:
        test = session.get(ABTest, test_id)
        if not test:
            raise HTTPException(404, "Test not found")

        variants = session.query(Variant).filter_by(ab_test_id=test_id).all()
        measurements = (
            session.query(Measurement)
            .filter_by(ab_test_id=test_id)
            .order_by(Measurement.cycle, Measurement.started_at)
            .all()
        )

        return TestDetail(
            id=test.id,
            video_id=test.video_id,
            video_title=test.video_title or "",
            status=test.status.value,
            cycles=test.cycles,
            current_cycle=test.current_cycle,
            current_variant_index=test.current_variant_index,
            rotation_order=test.rotation_order or "[]",
            rotation_interval=test.rotation_interval or 30,
            scheduled_start=test.scheduled_start,
            scheduled_end=test.scheduled_end,
            winner_variant_id=test.winner_variant_id,
            created_at=test.created_at,
            started_at=test.started_at,
            completed_at=test.completed_at,
            error_message=test.error_message,
            variants=[_variant_out(v) for v in variants],
            measurements=[_measurement_out(m, session) for m in measurements],
            test_mode=test.test_mode or "single",
            scheduled_days=test.scheduled_days or "",
            daily_start_time=test.daily_start_time or "",
            current_day_index=test.current_day_index or 0,
            total_days=test.total_days or 1,
        )
    finally:
        session.close()
