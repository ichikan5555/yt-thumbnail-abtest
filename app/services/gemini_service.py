"""Gemini Vision thumbnail classification (Feature 5/6)."""

import json
import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

CATEGORIES = [
    "human_face",
    "text_heavy",
    "text_minimal",
    "landscape",
    "product_closeup",
    "high_contrast",
    "bright_colors",
    "dark_theme",
    "before_after",
    "reaction_face",
    "arrow_indicator",
    "number_list",
]


class GeminiService:
    def classify_thumbnail(self, image_path: str) -> list[str]:
        """Classify a thumbnail image into categories using Gemini Vision."""
        if not settings.gemini_api_key:
            logger.warning("Gemini API key not configured")
            return []

        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.gemini_api_key)

            model = genai.GenerativeModel("gemini-2.0-flash")

            path = Path(image_path)
            if not path.is_file():
                logger.warning("Image not found: %s", image_path)
                return []

            import PIL.Image
            img = PIL.Image.open(path)

            prompt = (
                "Analyze this YouTube thumbnail image. "
                "Classify it into one or more of these categories: "
                f"{', '.join(CATEGORIES)}. "
                "Return ONLY a JSON array of matching category strings. "
                "Example: [\"human_face\", \"text_heavy\"]"
            )

            response = model.generate_content([prompt, img])
            text = response.text.strip()

            # Extract JSON array from response
            if "[" in text:
                json_str = text[text.index("["):text.rindex("]") + 1]
                categories = json.loads(json_str)
                # Filter to valid categories
                return [c for c in categories if c in CATEGORIES]
            return []

        except Exception as e:
            logger.error("Gemini classification failed: %s", e)
            return []

    def classify_thumbnail_from_bytes(self, image_bytes: bytes, filename: str = "thumb.jpg") -> list[str]:
        """Classify thumbnail from raw bytes."""
        if not settings.gemini_api_key:
            return []

        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.gemini_api_key)

            model = genai.GenerativeModel("gemini-2.0-flash")

            import io
            import PIL.Image
            img = PIL.Image.open(io.BytesIO(image_bytes))

            prompt = (
                "Analyze this YouTube thumbnail image. "
                "Classify it into one or more of these categories: "
                f"{', '.join(CATEGORIES)}. "
                "Return ONLY a JSON array of matching category strings."
            )

            response = model.generate_content([prompt, img])
            text = response.text.strip()

            if "[" in text:
                json_str = text[text.index("["):text.rindex("]") + 1]
                categories = json.loads(json_str)
                return [c for c in categories if c in CATEGORIES]
            return []

        except Exception as e:
            logger.error("Gemini classification from bytes failed: %s", e)
            return []

    def generate_recommendations(self, category_stats: dict) -> str:
        """Generate recommendations based on category analysis."""
        if not settings.gemini_api_key:
            return ""

        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.gemini_api_key)

            model = genai.GenerativeModel("gemini-2.0-flash")

            prompt = (
                "Based on the following YouTube thumbnail category analysis, "
                "provide 3-5 brief recommendations for improving thumbnail performance. "
                f"Category stats: {json.dumps(category_stats, indent=2)}\n"
                "Return as a JSON array of recommendation strings."
            )

            response = model.generate_content(prompt)
            text = response.text.strip()

            if "[" in text:
                json_str = text[text.index("["):text.rindex("]") + 1]
                return json_str
            return "[]"

        except Exception as e:
            logger.error("Gemini recommendations failed: %s", e)
            return "[]"


gemini_service = GeminiService()
