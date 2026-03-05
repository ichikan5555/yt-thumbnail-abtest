"""YouTube OAuth2 per-user connection flow."""

import json
import logging
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

from app.api.deps import get_current_user
from app.config import settings
from app.database import get_session
from app.models import User
from app.services.youtube_api import SCOPES

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings/youtube", tags=["youtube-oauth"])

# In-memory state store: {state_token: (user_id, expires_at)}
_pending_states: dict[str, tuple[int, float]] = {}
STATE_TTL = 600  # 10 minutes


def _cleanup_states():
    """Remove expired states."""
    now = time.time()
    expired = [k for k, (_, exp) in _pending_states.items() if now > exp]
    for k in expired:
        del _pending_states[k]


class CredentialsIn(BaseModel):
    client_id: str
    client_secret: str


@router.post("/credentials")
def save_credentials(body: CredentialsIn, user: User = Depends(get_current_user)):
    """Save user's Google OAuth2 client_id and client_secret."""
    if not body.client_id.strip() or not body.client_secret.strip():
        raise HTTPException(400, "client_id and client_secret are required")

    session = get_session()
    try:
        db_user = session.get(User, user.id)
        db_user.youtube_client_id = body.client_id.strip()
        db_user.youtube_client_secret = body.client_secret.strip()
        session.commit()
        return {"status": "ok"}
    finally:
        session.close()


@router.get("/status")
def get_status(user: User = Depends(get_current_user)):
    """Check YouTube connection status."""
    session = get_session()
    try:
        db_user = session.get(User, user.id)
        connected = bool(db_user.youtube_token)
        return {
            "connected": connected,
            "channel_title": db_user.youtube_channel_title or "",
            "connected_at": db_user.youtube_connected_at.isoformat() if db_user.youtube_connected_at else None,
            "has_credentials": bool(db_user.youtube_client_id and db_user.youtube_client_secret),
        }
    finally:
        session.close()


@router.get("/connect")
def connect(user: User = Depends(get_current_user)):
    """Generate OAuth2 authorization URL and return it."""
    session = get_session()
    try:
        db_user = session.get(User, user.id)
        if not db_user.youtube_client_id or not db_user.youtube_client_secret:
            raise HTTPException(400, "Save client_id and client_secret first")

        # Determine callback URL
        callback_url = f"{settings.base_url}/api/settings/youtube/callback"

        client_config = {
            "web": {
                "client_id": db_user.youtube_client_id,
                "client_secret": db_user.youtube_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [callback_url],
            }
        }

        flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=callback_url)

        state = secrets.token_urlsafe(32)
        _cleanup_states()
        _pending_states[state] = (user.id, time.time() + STATE_TTL)

        auth_url, _ = flow.authorization_url(
            access_type="offline",
            prompt="consent",
            state=state,
        )

        return {"url": auth_url}
    finally:
        session.close()


@router.get("/callback")
def callback(code: str = Query(...), state: str = Query(...)):
    """Handle Google OAuth2 callback. Saves token and redirects to settings."""
    _cleanup_states()

    if state not in _pending_states:
        raise HTTPException(400, "Invalid or expired state")

    user_id, expires_at = _pending_states.pop(state)
    if time.time() > expires_at:
        raise HTTPException(400, "State expired")

    session = get_session()
    try:
        db_user = session.get(User, user_id)
        if not db_user or not db_user.youtube_client_id:
            raise HTTPException(400, "User or credentials not found")

        callback_url = f"{settings.base_url}/api/settings/youtube/callback"

        client_config = {
            "web": {
                "client_id": db_user.youtube_client_id,
                "client_secret": db_user.youtube_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [callback_url],
            }
        }

        flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=callback_url)
        flow.fetch_token(code=code)
        creds = flow.credentials

        # Try to get channel title
        channel_title = ""
        try:
            from googleapiclient.discovery import build
            yt = build("youtube", "v3", credentials=creds)
            resp = yt.channels().list(part="snippet", mine=True).execute()
            items = resp.get("items", [])
            if items:
                channel_title = items[0]["snippet"]["title"]
        except Exception as e:
            logger.warning("Failed to get channel title: %s", e)

        from datetime import datetime
        db_user.youtube_token = creds.to_json()
        db_user.youtube_connected_at = datetime.utcnow()
        db_user.youtube_channel_title = channel_title
        session.commit()

        logger.info("YouTube connected for user #%d (%s)", user_id, channel_title)
        return RedirectResponse(url="/settings?youtube=connected", status_code=302)
    finally:
        session.close()


@router.post("/disconnect")
def disconnect(user: User = Depends(get_current_user)):
    """Disconnect YouTube account."""
    session = get_session()
    try:
        db_user = session.get(User, user.id)
        db_user.youtube_token = None
        db_user.youtube_connected_at = None
        db_user.youtube_channel_title = ""
        session.commit()
        return {"status": "ok"}
    finally:
        session.close()
