"""Authentication service: password hashing, JWT, 2FA code management."""

import logging
import random
import string
from datetime import datetime, timedelta

import httpx
from jose import jwt
from passlib.context import CryptContext

from app.config import settings

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory 2FA code store: {email: {"code": str, "expires": datetime}}
_verification_codes: dict[str, dict] = {}


# ── Password ──

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ──

def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.jwt_expire_days)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except Exception:
        return None


# ── 2FA Code ──

def generate_2fa_code(email: str) -> str:
    """Generate 6-digit code with 5-minute validity."""
    code = "".join(random.choices(string.digits, k=6))
    _verification_codes[email] = {
        "code": code,
        "expires": datetime.utcnow() + timedelta(minutes=5),
    }
    return code


def verify_2fa_code(email: str, code: str) -> bool:
    """Verify and consume a 2FA code."""
    stored = _verification_codes.get(email)
    if not stored:
        return False
    if stored["expires"] < datetime.utcnow():
        _verification_codes.pop(email, None)
        return False
    if stored["code"] != code:
        return False
    _verification_codes.pop(email, None)
    return True


def send_code_via_chatwork(room_id: str, code: str) -> bool:
    """Send 2FA code via Chatwork API."""
    token = settings.chatwork_auth_token or settings.chatwork_api_token
    if not token or not room_id:
        logger.warning("Chatwork auth not configured (token or room_id missing)")
        return False
    try:
        body = f"[info][title]認証コード[/title]{code}\n（5分間有効）[/info]"
        resp = httpx.post(
            f"https://api.chatwork.com/v2/rooms/{room_id}/messages",
            headers={"X-ChatWorkToken": token},
            data={"body": body, "self_unread": "0"},
            timeout=10.0,
        )
        resp.raise_for_status()
        logger.info("2FA code sent to Chatwork room %s", room_id)
        return True
    except Exception as e:
        logger.error("Failed to send 2FA code via Chatwork: %s", e)
        return False


def send_code_via_email(email: str, code: str) -> bool:
    """Send 2FA code via SendGrid."""
    from app.services.email_service import email_service
    if not email_service.enabled:
        logger.warning("SendGrid not configured for 2FA email")
        return False
    subject = "[YT A/B Test] 認証コード / Verification Code"
    body = f"認証コード: {code}\n（5分間有効）\n\nVerification code: {code}\n(Valid for 5 minutes)"
    return email_service.send_email(subject, body)
