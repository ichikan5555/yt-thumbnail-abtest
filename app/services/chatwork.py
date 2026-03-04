"""Chatwork notification service."""

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

CHATWORK_API_URL = "https://api.chatwork.com/v2"


class ChatworkService:
    def __init__(self) -> None:
        self.token = settings.chatwork_api_token
        self.room_id = settings.chatwork_room_id

    @property
    def enabled(self) -> bool:
        return bool(self.token and self.room_id)

    def send_message(self, message: str) -> bool:
        if not self.enabled:
            logger.debug("Chatwork not configured, skipping")
            return False

        try:
            resp = httpx.post(
                f"{CHATWORK_API_URL}/rooms/{self.room_id}/messages",
                headers={"X-ChatWorkToken": self.token},
                data={"body": message, "self_unread": "0"},
                timeout=10.0,
            )
            resp.raise_for_status()
            logger.info("Chatwork message sent to room %s", self.room_id)
            return True
        except Exception as e:
            logger.error("Chatwork send failed: %s", e)
            return False


chatwork_service = ChatworkService()
