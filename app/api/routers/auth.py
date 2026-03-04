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


class LoginPasswordRequest(BaseModel):
    email: EmailStr
    password: str


class SendCodeRequest(BaseModel):
    email: EmailStr


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    auth_method: str
    plan: str
    trial_ends_at: datetime | None = None
    trial_active: bool = False
    trial_days_left: int = 0

    model_config = {"from_attributes": True}


# ── Helper ──

def _set_token_cookie(response: JSONResponse, token: str) -> JSONResponse:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
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

        if body.auth_method == "2fa_chatwork" and not body.chatwork_room_id:
            raise HTTPException(400, "Chatwork認証にはルームIDが必要です")

        user = User(
            email=body.email,
            name=body.name,
            password_hash=pw_hash,
            auth_method=body.auth_method,
            chatwork_room_id=body.chatwork_room_id,
            trial_ends_at=datetime.utcnow() + timedelta(days=14),
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        token = create_access_token(user.id, user.email)
        resp = JSONResponse(
            content=UserOut.model_validate(user).model_dump(),
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
        resp = JSONResponse(content=UserOut.model_validate(user).model_dump())
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
            ok = send_code_via_chatwork(room_id, code)
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
        resp = JSONResponse(content=UserOut.model_validate(user).model_dump())
        return _set_token_cookie(resp, token)
    finally:
        session.close()


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.post("/logout")
def logout():
    resp = JSONResponse(content={"success": True})
    resp.delete_cookie(key=COOKIE_NAME, path="/")
    return resp
