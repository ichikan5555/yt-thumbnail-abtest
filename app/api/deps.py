"""FastAPI dependency functions for authentication."""

from fastapi import Cookie, HTTPException

from app.database import get_session
from app.models import User
from app.services.auth_service import decode_access_token

COOKIE_NAME = "yt_abtest_token"


def get_current_user(yt_abtest_token: str | None = Cookie(default=None)) -> User:
    """Require authenticated user. Raises 401 if not logged in."""
    if not yt_abtest_token:
        raise HTTPException(401, "Not authenticated")
    payload = decode_access_token(yt_abtest_token)
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    session = get_session()
    try:
        user = session.get(User, int(payload["sub"]))
        if not user:
            raise HTTPException(401, "User not found")
        # Detach from session so caller can use it freely
        session.expunge(user)
        return user
    finally:
        session.close()


def get_optional_user(yt_abtest_token: str | None = Cookie(default=None)) -> User | None:
    """Return user if logged in, None otherwise. Never raises."""
    if not yt_abtest_token:
        return None
    payload = decode_access_token(yt_abtest_token)
    if not payload:
        return None
    session = get_session()
    try:
        user = session.get(User, int(payload["sub"]))
        if user:
            session.expunge(user)
        return user
    except Exception:
        return None
    finally:
        session.close()
