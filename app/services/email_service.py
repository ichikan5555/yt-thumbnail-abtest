"""SendGrid email notification service."""

import logging

from app.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self) -> None:
        self.api_key = settings.sendgrid_api_key
        self.from_email = settings.email_from
        self.to_email = settings.email_to

    @property
    def enabled(self) -> bool:
        return bool(self.api_key and self.from_email)

    def send_email(self, subject: str, body: str, to_email: str | None = None) -> bool:
        recipient = to_email or self.to_email
        if not self.enabled or not recipient:
            logger.debug("SendGrid not configured, skipping")
            return False

        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail

            message = Mail(
                from_email=self.from_email,
                to_emails=recipient,
                subject=subject,
                plain_text_content=body,
            )
            sg = SendGridAPIClient(self.api_key)
            response = sg.send(message)
            logger.info("Email sent, status: %d", response.status_code)
            return response.status_code in (200, 201, 202)
        except Exception as e:
            logger.error("Email send failed: %s", e)
            return False


email_service = EmailService()
