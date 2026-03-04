"""Unified notification facade (Chatwork + Slack + Email)."""

import json
import logging
from datetime import datetime

from app.database import get_session
from app.models import Notification
from app.services.chatwork import chatwork_service
from app.services.email_service import email_service
from app.services.slack_service import slack_service

logger = logging.getLogger(__name__)


def _get_enabled_channels() -> set[str]:
    """Load enabled notification channels from user_settings."""
    try:
        from app.api.routers.settings import get_setting_value
        raw = get_setting_value("notification_channels")
        if raw:
            return set(json.loads(raw))
    except Exception:
        pass
    return {"chatwork", "email", "slack"}


class Notifier:
    def notify_test_start(self, test_id: int, video_id: str, video_title: str) -> None:
        channels = _get_enabled_channels()

        msg = (
            f"[info][title]A/Bテスト開始[/title]"
            f"テスト #{test_id}\n"
            f"動画: {video_title}\n"
            f"Video ID: {video_id}[/info]"
        )
        if "chatwork" in channels:
            self._send_chatwork(test_id, "start", msg)

        slack_msg = f"🚀 *A/Bテスト #{test_id} 開始*\n動画: {video_title}\nVideo ID: `{video_id}`"
        if "slack" in channels:
            self._send_slack(test_id, "start", slack_msg)

    def notify_rotation(
        self,
        test_id: int,
        label: str,
        cycle: int,
        view_count: int,
        prev_label: str | None = None,
        prev_velocity: float | None = None,
    ) -> None:
        channels = _get_enabled_channels()

        parts = [
            f"[info][title]ローテーション[/title]",
            f"テスト #{test_id} | サイクル {cycle + 1}",
            f"現在のサムネイル: {label}",
            f"再生回数: {view_count:,}",
        ]
        if prev_label and prev_velocity is not None:
            parts.append(f"前回 ({prev_label}): {prev_velocity:.1f} views/h")
        parts.append("[/info]")
        msg = "\n".join(parts)
        if "chatwork" in channels:
            self._send_chatwork(test_id, "rotation", msg)

    def notify_complete(self, test_id: int, result_message: str) -> None:
        channels = _get_enabled_channels()

        cw_msg = f"[info][title]A/Bテスト完了[/title]{result_message}[/info]"
        if "chatwork" in channels:
            self._send_chatwork(test_id, "complete", cw_msg)

        slack_msg = f"✅ *A/Bテスト完了*\n```\n{result_message}\n```"
        if "slack" in channels:
            self._send_slack(test_id, "complete", slack_msg)

        email_subject = f"[YT A/B Test] テスト #{test_id} 完了"
        if "email" in channels:
            self._send_email(test_id, "complete", email_subject, result_message)

    def notify_error(self, test_id: int, error: str) -> None:
        channels = _get_enabled_channels()

        cw_msg = f"[info][title]A/Bテスト エラー[/title]テスト #{test_id}\n{error}[/info]"
        if "chatwork" in channels:
            self._send_chatwork(test_id, "error", cw_msg)

        slack_msg = f"❌ *A/Bテスト #{test_id} エラー*\n```{error}```"
        if "slack" in channels:
            self._send_slack(test_id, "error", slack_msg)

        email_subject = f"[YT A/B Test] テスト #{test_id} エラー"
        if "email" in channels:
            self._send_email(test_id, "error", email_subject, error)

    def _send_chatwork(self, test_id: int, event: str, message: str) -> None:
        success = chatwork_service.send_message(message)
        self._log(test_id, "chatwork", event, message, success)

    def _send_slack(self, test_id: int, event: str, message: str) -> None:
        success = slack_service.send_message(message)
        self._log(test_id, "slack", event, message, success)

    def _send_email(self, test_id: int, event: str, subject: str, body: str) -> None:
        success = email_service.send_email(subject, body)
        self._log(test_id, "email", event, f"{subject}\n\n{body}", success)

    def _log(
        self,
        test_id: int,
        channel: str,
        event: str,
        message: str,
        success: bool,
    ) -> None:
        session = get_session()
        try:
            n = Notification(
                ab_test_id=test_id,
                channel=channel,
                event=event,
                message=message,
                success=1 if success else 0,
            )
            session.add(n)
            session.commit()
        except Exception as e:
            logger.error("Failed to log notification: %s", e)
        finally:
            session.close()


notifier = Notifier()
