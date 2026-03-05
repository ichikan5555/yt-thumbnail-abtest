"""Competitor channel analysis service (Feature 6)."""

import json
import logging
from datetime import datetime

import httpx

from app.config import settings
from app.database import get_session
from app.models import CompetitorAnalysis
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)


class CompetitorService:
    def analyze_channel(self, channel_id: str, user_id: int | None = None) -> dict:
        """Analyze a competitor channel's thumbnails."""
        from app.services.youtube_api import youtube_api

        # Get channel info
        try:
            yt = youtube_api._get_service(user_id)
            ch_response = yt.channels().list(
                part="snippet,statistics",
                id=channel_id,
            ).execute()

            if not ch_response.get("items"):
                raise ValueError(f"Channel {channel_id} not found")

            channel = ch_response["items"][0]
            channel_title = channel["snippet"]["title"]

            # Search recent videos
            search_response = yt.search().list(
                part="snippet",
                channelId=channel_id,
                type="video",
                order="date",
                maxResults=20,
            ).execute()

            videos = search_response.get("items", [])
        except Exception as e:
            logger.error("YouTube API failed for channel %s: %s", channel_id, e)
            raise ValueError(f"Failed to fetch channel data: {e}")

        # Download thumbnails and classify
        all_categories: list[list[str]] = []
        video_details = []

        for video in videos:
            video_id = video["id"]["videoId"]
            title = video["snippet"]["title"]
            thumb_url = video["snippet"]["thumbnails"].get("high", {}).get("url", "")
            if not thumb_url:
                thumb_url = video["snippet"]["thumbnails"].get("default", {}).get("url", "")

            categories = []
            if thumb_url:
                try:
                    resp = httpx.get(thumb_url, timeout=10)
                    if resp.status_code == 200:
                        categories = gemini_service.classify_thumbnail_from_bytes(
                            resp.content, f"{video_id}.jpg"
                        )
                except Exception as e:
                    logger.warning("Failed to download thumbnail for %s: %s", video_id, e)

            all_categories.append(categories)
            video_details.append({
                "video_id": video_id,
                "title": title,
                "thumbnail_url": thumb_url,
                "categories": categories,
            })

        # Aggregate stats
        category_count: dict[str, int] = {}
        total_videos = len(video_details)
        face_count = 0
        text_count = 0

        for cats in all_categories:
            for cat in cats:
                category_count[cat] = category_count.get(cat, 0) + 1
            if "human_face" in cats or "reaction_face" in cats:
                face_count += 1
            if "text_heavy" in cats:
                text_count += 1

        face_rate = face_count / total_videos * 100 if total_videos > 0 else 0
        text_rate = text_count / total_videos * 100 if total_videos > 0 else 0

        # Generate AI recommendations
        recommendations_json = gemini_service.generate_recommendations({
            "channel_title": channel_title,
            "total_videos_analyzed": total_videos,
            "category_distribution": category_count,
            "face_usage_rate": f"{face_rate:.0f}%",
            "text_usage_rate": f"{text_rate:.0f}%",
        })

        result = {
            "channel_id": channel_id,
            "channel_title": channel_title,
            "video_count": total_videos,
            "category_distribution": category_count,
            "face_usage_rate": round(face_rate, 1),
            "text_usage_rate": round(text_rate, 1),
            "videos": video_details,
            "recommendations": recommendations_json,
        }

        # Save to DB
        session = get_session()
        try:
            analysis = CompetitorAnalysis(
                channel_id=channel_id,
                channel_title=channel_title,
                video_count=total_videos,
                analysis_result=json.dumps(result),
                user_id=user_id,
            )
            session.add(analysis)
            session.commit()
            session.refresh(analysis)
            result["id"] = analysis.id
        finally:
            session.close()

        return result


competitor_service = CompetitorService()
