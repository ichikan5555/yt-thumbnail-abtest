"""YouTube Data API v3 client with OAuth2 and retry logic."""

import json
import logging
import time
from datetime import date
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from app.config import settings
from app.database import get_session
from app.models import QuotaLog, User

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
]


class YouTubeAPI:
    def __init__(self) -> None:
        self._service = None

    def _get_credentials(self) -> Credentials:
        """Get credentials from global token file (admin/CLI use)."""
        token_path = Path(settings.token_path)
        creds = None

        if token_path.exists():
            creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                token_path.write_text(creds.to_json())
                logger.info("Token refreshed successfully")
            except Exception:
                logger.warning("Token refresh failed, re-authentication needed")
                creds = None

        if not creds or not creds.valid:
            raise RuntimeError(
                "No valid credentials. Run 'python -m app.main auth' first."
            )

        return creds

    def _get_user_credentials(self, user_id: int) -> Credentials | None:
        """Get credentials from user's stored OAuth2 token."""
        session = get_session()
        try:
            user = session.get(User, user_id)
            if not user or not user.youtube_token:
                return None

            token_data = json.loads(user.youtube_token)
            creds = Credentials.from_authorized_user_info(token_data, SCOPES)

            if creds and creds.expired and creds.refresh_token:
                try:
                    creds.refresh(Request())
                    # Save refreshed token back to DB
                    user.youtube_token = creds.to_json()
                    session.commit()
                    logger.info("User #%d token refreshed", user_id)
                except Exception:
                    logger.warning("User #%d token refresh failed", user_id)
                    return None

            if not creds or not creds.valid:
                return None

            return creds
        finally:
            session.close()

    def get_service_for_user(self, user_id: int | None = None):
        """Get YouTube service, preferring user credentials if available."""
        if user_id:
            creds = self._get_user_credentials(user_id)
            if creds:
                return build("youtube", "v3", credentials=creds)
        # Fallback to global credentials
        return self.service

    def authenticate_interactive(self) -> None:
        """Run OAuth2 flow interactively (opens browser). Admin/CLI use."""
        client_config = {
            "installed": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": ["http://localhost"],
            }
        }
        flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
        creds = flow.run_local_server(port=0)

        token_path = Path(settings.token_path)
        token_path.parent.mkdir(parents=True, exist_ok=True)
        token_path.write_text(creds.to_json())
        logger.info("Authentication successful, token saved to %s", token_path)

    @property
    def service(self):
        if self._service is None:
            creds = self._get_credentials()
            self._service = build("youtube", "v3", credentials=creds)
        return self._service

    def _get_service(self, user_id: int | None = None):
        """Alias for get_service_for_user."""
        return self.get_service_for_user(user_id)

    def _retry(self, func, *args, **kwargs):
        """Execute with exponential backoff retry."""
        for attempt in range(settings.api_max_retries):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                error_str = str(e)
                if "quotaExceeded" in error_str:
                    raise
                if attempt == settings.api_max_retries - 1:
                    raise
                delay = settings.api_retry_base_delay * (2 ** attempt)
                logger.warning(
                    "API call failed (attempt %d/%d), retrying in %.1fs: %s",
                    attempt + 1, settings.api_max_retries, delay, e,
                )
                time.sleep(delay)

    def _log_quota(self, operation: str, units: int, ab_test_id: int | None = None, user_id: int | None = None) -> None:
        session = get_session()
        try:
            log = QuotaLog(
                date=date.today().isoformat(),
                operation=operation,
                units=units,
                ab_test_id=ab_test_id,
                user_id=user_id,
            )
            session.add(log)
            session.commit()
        finally:
            session.close()

    def get_video_info(self, video_id: str, ab_test_id: int | None = None, user_id: int | None = None) -> dict:
        """Get video title and view count. Costs 1 quota unit."""
        svc = self._get_service(user_id)

        def _call():
            resp = svc.videos().list(
                part="snippet,statistics",
                id=video_id,
            ).execute()
            items = resp.get("items", [])
            if not items:
                raise ValueError(f"Video not found: {video_id}")
            item = items[0]
            return {
                "title": item["snippet"]["title"],
                "view_count": int(item["statistics"].get("viewCount", 0)),
            }

        result = self._retry(_call)
        self._log_quota("videos.list", 1, ab_test_id, user_id)
        return result

    def get_view_count(self, video_id: str, ab_test_id: int | None = None, user_id: int | None = None) -> int:
        """Get current view count. Costs 1 quota unit."""
        svc = self._get_service(user_id)

        def _call():
            resp = svc.videos().list(
                part="statistics",
                id=video_id,
            ).execute()
            items = resp.get("items", [])
            if not items:
                raise ValueError(f"Video not found: {video_id}")
            return int(items[0]["statistics"].get("viewCount", 0))

        result = self._retry(_call)
        self._log_quota("videos.list", 1, ab_test_id, user_id)
        return result

    def set_thumbnail(self, video_id: str, image_path: str, ab_test_id: int | None = None, user_id: int | None = None) -> None:
        """Set video thumbnail. Costs 50 quota units."""
        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Thumbnail file not found: {image_path}")

        svc = self._get_service(user_id)

        def _call():
            media = MediaFileUpload(str(path), mimetype="image/jpeg")
            svc.thumbnails().set(
                videoId=video_id,
                media_body=media,
            ).execute()

        self._retry(_call)
        self._log_quota("thumbnails.set", 50, ab_test_id, user_id)
        logger.info("Thumbnail set for %s: %s", video_id, image_path)

    def get_daily_quota_used(self, user_id: int | None = None) -> int:
        """Get total quota units used today (optionally per user)."""
        session = get_session()
        try:
            from sqlalchemy import func
            query = session.query(func.sum(QuotaLog.units)).filter(
                QuotaLog.date == date.today().isoformat()
            )
            if user_id is not None:
                query = query.filter(QuotaLog.user_id == user_id)
            result = query.scalar()
            return result or 0
        finally:
            session.close()

    def check_quota_available(self, required_units: int, user_id: int | None = None) -> bool:
        """Check if enough quota remains for the operation."""
        used = self.get_daily_quota_used(user_id)
        return (used + required_units) <= settings.daily_quota_limit


youtube_api = YouTubeAPI()
