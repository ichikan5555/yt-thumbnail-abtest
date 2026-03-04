"""Backup router — Pro plan only: export thumbnails + test data as zip."""

import json
import logging
import os
import zipfile
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.config import settings, BASE_DIR
from app.database import get_session
from app.models import ABTest, Variant, Measurement, DegradationCheck
from app.api.deps import get_current_user
from app.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/backup", tags=["backup"])

BACKUP_DIR = BASE_DIR / "data" / "backups"


def _require_pro(user: User):
    """Raise 403 if user is not on Pro plan (trial counts as Pro-equivalent)."""
    if user.plan != "pro" and not user.trial_active:
        raise HTTPException(403, "Backup is a Pro feature")


@router.post("/create")
def create_backup(user: User = Depends(get_current_user)):
    """Create a zip backup of all thumbnails and test data (JSON)."""
    _require_pro(user)

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.zip"
    zip_path = BACKUP_DIR / filename

    session = get_session()
    try:
        # Gather test data
        tests = session.query(ABTest).order_by(ABTest.id).all()
        export_data = []
        for t in tests:
            variants_data = []
            for v in t.variants:
                variants_data.append({
                    "id": v.id,
                    "label": v.label,
                    "image_path": v.image_path,
                    "total_velocity": v.total_velocity,
                    "measurement_count": v.measurement_count,
                    "thumbnail_categories": v.thumbnail_categories,
                })

            measurements_data = []
            for m in t.measurements:
                measurements_data.append({
                    "id": m.id,
                    "variant_id": m.variant_id,
                    "cycle": m.cycle,
                    "view_count_start": m.view_count_start,
                    "view_count_end": m.view_count_end,
                    "started_at": m.started_at.isoformat() if m.started_at else None,
                    "ended_at": m.ended_at.isoformat() if m.ended_at else None,
                    "duration_minutes": m.duration_minutes,
                    "velocity": m.velocity,
                })

            degradation_data = []
            deg_checks = session.query(DegradationCheck).filter_by(ab_test_id=t.id).all()
            for d in deg_checks:
                degradation_data.append({
                    "day_number": d.day_number,
                    "view_count": d.view_count,
                    "daily_views": d.daily_views,
                    "velocity_24h": d.velocity_24h,
                    "checked_at": d.checked_at.isoformat() if d.checked_at else None,
                })

            export_data.append({
                "id": t.id,
                "video_id": t.video_id,
                "video_title": t.video_title,
                "status": t.status.value if t.status else None,
                "cycles": t.cycles,
                "current_cycle": t.current_cycle,
                "rotation_interval": t.rotation_interval,
                "rotation_order": t.rotation_order,
                "metric_weights": t.metric_weights,
                "winner_variant_id": t.winner_variant_id,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "started_at": t.started_at.isoformat() if t.started_at else None,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                "test_mode": t.test_mode,
                "scheduled_days": t.scheduled_days,
                "daily_start_time": t.daily_start_time,
                "total_days": t.total_days,
                "degradation_tracking": t.degradation_tracking,
                "degradation_alert": t.degradation_alert,
                "variants": variants_data,
                "measurements": measurements_data,
                "degradation_checks": degradation_data,
            })

        # Create zip
        with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED) as zf:
            # Add JSON data
            zf.writestr("data.json", json.dumps(export_data, ensure_ascii=False, indent=2))

            # Add thumbnail images
            thumb_dir = settings.thumbnail_upload_dir
            if thumb_dir.is_dir():
                for img_file in thumb_dir.iterdir():
                    if img_file.is_file():
                        zf.write(str(img_file), f"thumbnails/{img_file.name}")

        file_size = zip_path.stat().st_size
        logger.info("Backup created: %s (%d bytes)", filename, file_size)
        return {
            "filename": filename,
            "size": file_size,
            "created_at": datetime.utcnow().isoformat(),
            "test_count": len(export_data),
        }
    finally:
        session.close()


@router.get("/list")
def list_backups(user: User = Depends(get_current_user)):
    """List existing backup files."""
    _require_pro(user)

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    backups = []
    for f in sorted(BACKUP_DIR.iterdir(), reverse=True):
        if f.is_file() and f.suffix == ".zip":
            stat = f.stat()
            backups.append({
                "filename": f.name,
                "size": stat.st_size,
                "created_at": datetime.utcfromtimestamp(stat.st_mtime).isoformat(),
            })
    return backups


@router.get("/download/{filename}")
def download_backup(filename: str, user: User = Depends(get_current_user)):
    """Download a backup zip file."""
    _require_pro(user)

    # Prevent path traversal
    safe_name = Path(filename).name
    file_path = BACKUP_DIR / safe_name
    if not file_path.is_file():
        raise HTTPException(404, "Backup not found")
    return FileResponse(
        str(file_path),
        media_type="application/zip",
        filename=safe_name,
    )


@router.delete("/{filename}")
def delete_backup(filename: str, user: User = Depends(get_current_user)):
    """Delete a backup file."""
    _require_pro(user)

    safe_name = Path(filename).name
    file_path = BACKUP_DIR / safe_name
    if not file_path.is_file():
        raise HTTPException(404, "Backup not found")
    file_path.unlink()
    logger.info("Backup deleted: %s", safe_name)
    return {"deleted": safe_name}
