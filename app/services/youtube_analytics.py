"""YouTube Analytics API client for fetching video metrics."""

import json
import logging
from datetime import datetime, date, timedelta
from pathlib import Path

from googleapiclient.discovery import build

from app.config import settings
from app.database import get_session
from app.models import ABTest, Measurement, Variant, VariantAnalytics

logger = logging.getLogger(__name__)

ANALYTICS_METRICS = (
    "views,estimatedMinutesWatched,averageViewDuration,"
    "averageViewPercentage,likes,shares,comments"
)


class YouTubeAnalyticsService:
    def __init__(self):
        self._service = None

    def _get_service(self, user_id: int | None = None):
        """Get Analytics service, preferring user credentials if available."""
        if user_id:
            from app.services.youtube_api import youtube_api
            creds = youtube_api._get_user_credentials(user_id)
            if creds:
                return build("youtubeAnalytics", "v2", credentials=creds)
        # Fallback to global
        return self.service

    @property
    def service(self):
        if self._service is None:
            from app.services.youtube_api import youtube_api
            creds = youtube_api._get_credentials()
            self._service = build("youtubeAnalytics", "v2", credentials=creds)
        return self._service

    def fetch_video_analytics(
        self, video_id: str, start_date: date, end_date: date, user_id: int | None = None,
    ) -> list[dict]:
        """Fetch daily analytics for a video. Returns list of {date, metrics...}."""
        try:
            svc = self._get_service(user_id)
            response = svc.reports().query(
                ids="channel==MINE",
                startDate=start_date.isoformat(),
                endDate=end_date.isoformat(),
                metrics=ANALYTICS_METRICS,
                dimensions="day",
                filters=f"video=={video_id}",
                sort="day",
            ).execute()
        except Exception as e:
            logger.warning("Analytics API call failed: %s", e)
            return []

        headers = [col["name"] for col in response.get("columnHeaders", [])]
        rows = []
        for row in response.get("rows", []):
            rows.append(dict(zip(headers, row)))
        return rows

    def fetch_and_store(self, test_id: int) -> dict[str, dict]:
        """Fetch analytics for a completed test and store per-variant data.

        Returns dict of {variant_label: {metric: value}}.
        """
        session = get_session()
        try:
            test = session.get(ABTest, test_id)
            if not test:
                raise ValueError(f"Test #{test_id} not found")

            variants = session.query(Variant).filter_by(ab_test_id=test_id).all()
            measurements = (
                session.query(Measurement)
                .filter_by(ab_test_id=test_id)
                .filter(Measurement.ended_at.isnot(None))
                .order_by(Measurement.started_at)
                .all()
            )

            if not measurements:
                return {}

            # Determine date range
            first_start = min(m.started_at for m in measurements)
            last_end = max(m.ended_at for m in measurements)
            start_date = first_start.date()
            end_date = (last_end + timedelta(days=1)).date()

            # Fetch daily analytics
            daily_data = self.fetch_video_analytics(
                test.video_id, start_date, end_date, user_id=test.user_id
            )

            if not daily_data:
                logger.info("No analytics data available yet for test #%d", test_id)
                # Store zeros with a flag
                result = {}
                for v in variants:
                    va = VariantAnalytics(
                        ab_test_id=test_id, variant_id=v.id,
                    )
                    session.add(va)
                    result[v.label] = _va_to_dict(va)
                test.analytics_fetched_at = datetime.utcnow()
                session.commit()
                return result

            # Calculate time each variant was active per day
            variant_day_fractions: dict[int, dict[str, float]] = {
                v.id: {} for v in variants
            }
            for m in measurements:
                vid = m.variant_id
                day = m.started_at.date()
                end_day = m.ended_at.date()
                # Single-day measurement
                if day == end_day:
                    hours = (m.ended_at - m.started_at).total_seconds() / 3600
                    key = day.isoformat()
                    variant_day_fractions[vid][key] = (
                        variant_day_fractions[vid].get(key, 0) + hours
                    )
                else:
                    # Spans midnight — attribute to each day proportionally
                    d = day
                    while d <= end_day:
                        day_start = max(m.started_at, datetime(d.year, d.month, d.day))
                        day_end = min(
                            m.ended_at,
                            datetime(d.year, d.month, d.day, 23, 59, 59),
                        )
                        hours = max(0, (day_end - day_start).total_seconds() / 3600)
                        key = d.isoformat()
                        variant_day_fractions[vid][key] = (
                            variant_day_fractions[vid].get(key, 0) + hours
                        )
                        d += timedelta(days=1)

            # For each day, compute each variant's share and attribute analytics
            variant_metrics: dict[int, dict[str, float]] = {
                v.id: {
                    "impressions": 0, "ctr_weighted": 0, "ctr_hours": 0,
                    "avg_view_duration_weighted": 0, "avd_hours": 0,
                    "avg_view_percentage_weighted": 0, "avp_hours": 0,
                    "estimated_minutes_watched": 0,
                    "likes": 0, "shares": 0, "comments": 0,
                }
                for v in variants
            }

            for day_row in daily_data:
                day_key = day_row.get("day", "")
                # Total hours all variants were active this day
                total_hours = sum(
                    fracs.get(day_key, 0)
                    for fracs in variant_day_fractions.values()
                )
                if total_hours == 0:
                    continue

                for vid, fracs in variant_day_fractions.items():
                    hours = fracs.get(day_key, 0)
                    if hours == 0:
                        continue
                    share = hours / total_hours

                    vm = variant_metrics[vid]
                    views = day_row.get("views", 0) or 0
                    vm["impressions"] += (views / 0.05 if views else 0) * share  # rough estimate
                    vm["ctr_weighted"] += (day_row.get("averageViewPercentage", 0) or 0) * hours
                    vm["ctr_hours"] += hours
                    vm["avg_view_duration_weighted"] += (
                        (day_row.get("averageViewDuration", 0) or 0) * hours
                    )
                    vm["avd_hours"] += hours
                    vm["avg_view_percentage_weighted"] += (
                        (day_row.get("averageViewPercentage", 0) or 0) * hours
                    )
                    vm["avp_hours"] += hours
                    vm["estimated_minutes_watched"] += (
                        (day_row.get("estimatedMinutesWatched", 0) or 0) * share
                    )
                    vm["likes"] += (day_row.get("likes", 0) or 0) * share
                    vm["shares"] += (day_row.get("shares", 0) or 0) * share
                    vm["comments"] += (day_row.get("comments", 0) or 0) * share

            # Delete old analytics for this test
            session.query(VariantAnalytics).filter_by(ab_test_id=test_id).delete()

            result = {}
            for v in variants:
                vm = variant_metrics[v.id]
                avd_hours = vm["avd_hours"]
                avp_hours = vm["avp_hours"]

                va = VariantAnalytics(
                    ab_test_id=test_id,
                    variant_id=v.id,
                    impressions=vm["impressions"],
                    ctr=0,  # Will be overridden if data available
                    avg_view_duration=(
                        vm["avg_view_duration_weighted"] / avd_hours
                        if avd_hours > 0 else 0
                    ),
                    avg_view_percentage=(
                        vm["avg_view_percentage_weighted"] / avp_hours
                        if avp_hours > 0 else 0
                    ),
                    estimated_minutes_watched=vm["estimated_minutes_watched"],
                    likes=int(vm["likes"]),
                    shares=int(vm["shares"]),
                    comments=int(vm["comments"]),
                )
                session.add(va)
                result[v.label] = _va_to_dict(va)

            test.analytics_fetched_at = datetime.utcnow()
            session.commit()
            logger.info("Analytics stored for test #%d (%d days)", test_id, len(daily_data))
            return result
        finally:
            session.close()

    def get_stored_analytics(self, test_id: int) -> dict[str, dict]:
        """Get previously fetched analytics from DB."""
        session = get_session()
        try:
            rows = (
                session.query(VariantAnalytics)
                .filter_by(ab_test_id=test_id)
                .all()
            )
            result = {}
            for va in rows:
                v = session.get(Variant, va.variant_id)
                if v:
                    result[v.label] = _va_to_dict(va)
            return result
        finally:
            session.close()


def _va_to_dict(va: VariantAnalytics) -> dict:
    return {
        "impressions": va.impressions,
        "ctr": va.ctr,
        "avg_view_duration": va.avg_view_duration,
        "avg_view_percentage": va.avg_view_percentage,
        "estimated_minutes_watched": va.estimated_minutes_watched,
        "likes": va.likes,
        "shares": va.shares,
        "comments": va.comments,
    }


youtube_analytics = YouTubeAnalyticsService()
