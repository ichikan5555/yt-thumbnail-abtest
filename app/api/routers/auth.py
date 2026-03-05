"""Authentication API: register, login (password/2FA), me, logout."""

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr

from app.api.deps import COOKIE_NAME, get_current_user
from app.config import settings
from app.database import get_session
from app.models import User
from app.services.auth_service import (
    create_access_token,
    generate_2fa_code,
    hash_password,
    send_code_via_chatwork,
    send_code_via_email,
    verify_2fa_code,
    verify_password,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas ──

class RegisterRequest(BaseModel):
    email: EmailStr
    name: str = ""
    password: str | None = None
    auth_method: str = "password"  # password | 2fa_chatwork | 2fa_email
    chatwork_room_id: str | None = None
    chatwork_api_token: str | None = None


class LoginPasswordRequest(BaseModel):
    email: EmailStr
    password: str


class SendCodeRequest(BaseModel):
    email: EmailStr


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


class UpdateAuthMethodRequest(BaseModel):
    auth_method: str  # password | 2fa_chatwork | 2fa_email
    password: str | None = None
    chatwork_room_id: str | None = None
    chatwork_api_token: str | None = None


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    auth_method: str
    plan: str
    trial_ends_at: datetime | None = None
    trial_active: bool = False
    trial_days_left: int = 0
    youtube_connected: bool = False
    youtube_channel_title: str = ""

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user: User) -> "UserOut":
        return cls(
            id=user.id,
            email=user.email,
            name=user.name or "",
            auth_method=user.auth_method,
            plan=user.plan,
            trial_ends_at=user.trial_ends_at,
            trial_active=user.trial_active,
            trial_days_left=user.trial_days_left,
            youtube_connected=bool(user.youtube_token),
            youtube_channel_title=user.youtube_channel_title or "",
        )


# ── Helper ──

def _set_token_cookie(response: JSONResponse, token: str) -> JSONResponse:
    is_https = settings.base_url.startswith("https")
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=is_https,
        samesite="lax",
        max_age=settings.jwt_expire_days * 86400,
        path="/",
    )
    return response


# ── Endpoints ──

@router.post("/register", response_model=UserOut, status_code=201)
def register(body: RegisterRequest):
    session = get_session()
    try:
        existing = session.query(User).filter_by(email=body.email).first()
        if existing:
            raise HTTPException(400, "このメールアドレスは既に登録されています")

        if body.auth_method == "password":
            if not body.password or len(body.password) < 8:
                raise HTTPException(400, "パスワードは8文字以上で入力してください")
            pw_hash = hash_password(body.password)
        else:
            pw_hash = None

        if body.auth_method == "2fa_chatwork":
            if not body.chatwork_room_id:
                raise HTTPException(400, "Chatwork認証にはルームIDが必要です")
            if not body.chatwork_api_token:
                raise HTTPException(400, "Chatwork認証にはAPIトークンが必要です")

        user = User(
            email=body.email,
            name=body.name,
            password_hash=pw_hash,
            auth_method=body.auth_method,
            chatwork_room_id=body.chatwork_room_id,
            chatwork_api_token=body.chatwork_api_token,
            trial_ends_at=datetime.utcnow() + timedelta(days=14),
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        token = create_access_token(user.id, user.email)
        resp = JSONResponse(
            content=UserOut.from_user(user).model_dump(mode="json"),
            status_code=201,
        )
        return _set_token_cookie(resp, token)
    finally:
        session.close()


@router.post("/login")
def login_password(body: LoginPasswordRequest):
    session = get_session()
    try:
        user = session.query(User).filter_by(email=body.email).first()
        if not user:
            raise HTTPException(401, "メールアドレスまたはパスワードが間違っています")
        if user.auth_method != "password":
            raise HTTPException(400, "このアカウントは二段階認証を使用しています")
        if not user.password_hash or not verify_password(body.password, user.password_hash):
            raise HTTPException(401, "メールアドレスまたはパスワードが間違っています")

        token = create_access_token(user.id, user.email)
        resp = JSONResponse(content=UserOut.from_user(user).model_dump(mode="json"))
        return _set_token_cookie(resp, token)
    finally:
        session.close()


@router.post("/send-code")
def send_code(body: SendCodeRequest):
    session = get_session()
    try:
        user = session.query(User).filter_by(email=body.email).first()
        if not user:
            raise HTTPException(404, "アカウントが見つかりません")
        if user.auth_method not in ("2fa_chatwork", "2fa_email"):
            raise HTTPException(400, "このアカウントはパスワード認証を使用しています")

        code = generate_2fa_code(user.email)

        if user.auth_method == "2fa_chatwork":
            room_id = user.chatwork_room_id or settings.chatwork_auth_room_id
            if not room_id:
                raise HTTPException(500, "Chatwork認証ルームが設定されていません")
            ok = send_code_via_chatwork(room_id, code, user_token=user.chatwork_api_token)
            if not ok:
                raise HTTPException(500, "Chatworkへの送信に失敗しました")
            return {"success": True, "channel": "chatwork", "message": "Chatworkに認証コードを送信しました"}
        else:
            ok = send_code_via_email(user.email, code)
            if not ok:
                raise HTTPException(500, "メール送信に失敗しました")
            return {"success": True, "channel": "email", "message": "メールに認証コードを送信しました"}
    finally:
        session.close()


@router.post("/verify-code")
def verify_code(body: VerifyCodeRequest):
    session = get_session()
    try:
        user = session.query(User).filter_by(email=body.email).first()
        if not user:
            raise HTTPException(404, "アカウントが見つかりません")

        if not verify_2fa_code(user.email, body.code):
            raise HTTPException(401, "コードが間違っているか有効期限が切れています")

        token = create_access_token(user.id, user.email)
        resp = JSONResponse(content=UserOut.from_user(user).model_dump(mode="json"))
        return _set_token_cookie(resp, token)
    finally:
        session.close()


@router.put("/method")
def update_auth_method(body: UpdateAuthMethodRequest, user: User = Depends(get_current_user)):
    allowed = ("password", "2fa_email", "2fa_chatwork")
    if body.auth_method not in allowed:
        raise HTTPException(400, f"auth_method must be one of {allowed}")

    if body.auth_method == "password":
        if not body.password or len(body.password) < 8:
            raise HTTPException(400, "パスワードは8文字以上で入力してください")

    if body.auth_method == "2fa_chatwork":
        if not body.chatwork_room_id:
            raise HTTPException(400, "Chatwork認証にはルームIDが必要です")
        if not body.chatwork_api_token:
            raise HTTPException(400, "Chatwork認証にはAPIトークンが必要です")

    session = get_session()
    try:
        db_user = session.get(User, user.id)
        if not db_user:
            raise HTTPException(404, "ユーザーが見つかりません")

        db_user.auth_method = body.auth_method

        if body.auth_method == "password":
            db_user.password_hash = hash_password(body.password)
            db_user.chatwork_room_id = None
            db_user.chatwork_api_token = None
        elif body.auth_method == "2fa_email":
            db_user.password_hash = None
            db_user.chatwork_room_id = None
            db_user.chatwork_api_token = None
        elif body.auth_method == "2fa_chatwork":
            db_user.password_hash = None
            db_user.chatwork_room_id = body.chatwork_room_id
            db_user.chatwork_api_token = body.chatwork_api_token

        session.commit()
        session.refresh(db_user)
        return UserOut.from_user(db_user)
    finally:
        session.close()


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    # Need to re-read from DB to get youtube_token field (expunged user may not have it)
    session = get_session()
    try:
        db_user = session.get(User, user.id)
        return UserOut.from_user(db_user)
    finally:
        session.close()


@router.post("/logout")
def logout():
    resp = JSONResponse(content={"success": True})
    resp.delete_cookie(key=COOKIE_NAME, path="/")
    return resp
