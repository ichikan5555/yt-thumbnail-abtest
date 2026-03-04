"""Report router — Pro plan only: PDF report generation + logo management."""

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from app.config import BASE_DIR
from app.api.deps import get_current_user
from app.models import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["report"])

LOGO_PATH = BASE_DIR / "data" / "logo.png"
MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2MB


def _require_pro(user: User):
    """Raise 403 if user is not on Pro plan (trial counts as Pro-equivalent)."""
    if user.plan != "pro" and not user.trial_active:
        raise HTTPException(403, "PDF Report is a Pro feature")


@router.post("/api/tests/{test_id}/report")
def generate_report_endpoint(test_id: int, user: User = Depends(get_current_user)):
    """Generate a PDF report for a completed test (Pro only)."""
    _require_pro(user)

    from app.services.pdf_service import generate_report

    logo = LOGO_PATH if LOGO_PATH.is_file() else None
    try:
        pdf_path = generate_report(test_id, logo_path=logo)
    except Exception as e:
        logger.error("PDF generation failed for test %d: %s", test_id, e)
        raise HTTPException(500, f"Report generation failed: {e}")

    return FileResponse(
        str(pdf_path),
        media_type="application/pdf",
        filename=pdf_path.name,
    )


@router.post("/api/settings/logo")
def upload_logo(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Upload a logo image for PDF reports (Pro only)."""
    _require_pro(user)

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image files are allowed")

    content = file.file.read()
    if len(content) > MAX_LOGO_SIZE:
        raise HTTPException(400, "Logo file must be under 2MB")

    LOGO_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOGO_PATH.write_bytes(content)
    logger.info("Logo uploaded: %d bytes", len(content))
    return {"status": "ok"}


@router.delete("/api/settings/logo")
def delete_logo(user: User = Depends(get_current_user)):
    """Delete the uploaded logo (Pro only)."""
    _require_pro(user)

    if LOGO_PATH.is_file():
        LOGO_PATH.unlink()
        logger.info("Logo deleted")
    return {"status": "ok"}


@router.get("/api/settings/logo")
def get_logo_status():
    """Check if a logo exists."""
    return {"has_logo": LOGO_PATH.is_file()}
