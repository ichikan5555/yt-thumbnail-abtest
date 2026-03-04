"""Contact form API."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr

from app.database import get_session
from app.models import ContactMessage
from app.services.notifier import notifier

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/contact", tags=["contact"])


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str


@router.post("", status_code=201)
def submit_contact(body: ContactRequest):
    session = get_session()
    try:
        msg = ContactMessage(
            name=body.name,
            email=body.email,
            subject=body.subject,
            message=body.message,
        )
        session.add(msg)
        session.commit()
        logger.info("Contact message saved: %s from %s", body.subject, body.email)
        return {"success": True, "message": "お問い合わせを受け付けました"}
    finally:
        session.close()
