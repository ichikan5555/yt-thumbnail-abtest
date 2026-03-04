"""Slack webhook notification service."""

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class SlackService:
    def send_message(self, text: str) -> bool:
        if not settings.slack_webhook_url:
            logger.debug("Slack not configured, skipping")
            return False
        try:
            resp = httpx.post(
                settings.slack_webhook_url,
                json={"text": text},
                timeout=10,
            )
            resp.raise_for_status()
            return True
        except Exception as e:
            logger.error("Slack send failed: %s", e)
            return False


slack_service = SlackService()
