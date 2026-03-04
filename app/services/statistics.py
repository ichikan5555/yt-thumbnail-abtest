"""Statistical significance analysis (Feature 2)."""

import logging
from itertools import combinations

from app.database import get_session
from app.models import ABTest, Measurement, Variant

logger = logging.getLogger(__name__)


def compute_significance(test_id: int) -> dict:
    """Compare all variant pairs using Mann-Whitney U test."""
    session = get_session()
    try:
        test = session.get(ABTest, test_id)
        if not test:
            raise ValueError(f"Test #{test_id} not found")

        variants = session.query(Variant).filter_by(ab_test_id=test_id).all()
        variant_map = {v.id: v for v in variants}

        # Collect velocities per variant
        velocities: dict[str, list[float]] = {}
        measurements = (
            session.query(Measurement)
            .filter_by(ab_test_id=test_id)
            .filter(Measurement.velocity.isnot(None))
            .all()
        )
        for m in measurements:
            v = variant_map.get(m.variant_id)
            if v:
                velocities.setdefault(v.label, []).append(m.velocity)

        sample_sizes = {label: len(vals) for label, vals in velocities.items()}
        pairs = []

        labels = sorted(velocities.keys())
        for a, b in combinations(labels, 2):
            vals_a = velocities[a]
            vals_b = velocities[b]

            if len(vals_a) < 2 or len(vals_b) < 2:
                pairs.append({
                    "variant_a": a,
                    "variant_b": b,
                    "p_value": 1.0,
                    "confidence_pct": 0.0,
                    "significant": False,
                    "better_variant": "",
                })
                continue

            try:
                from scipy.stats import mannwhitneyu
                stat, p_value = mannwhitneyu(vals_a, vals_b, alternative="two-sided")
            except Exception:
                p_value = 1.0

            confidence = (1 - p_value) * 100
            mean_a = sum(vals_a) / len(vals_a)
            mean_b = sum(vals_b) / len(vals_b)
            better = a if mean_a > mean_b else b

            pairs.append({
                "variant_a": a,
                "variant_b": b,
                "p_value": round(p_value, 4),
                "confidence_pct": round(confidence, 1),
                "significant": p_value < 0.05,
                "better_variant": better,
            })

        overall = any(p["significant"] for p in pairs) if pairs else False

        return {
            "test_id": test_id,
            "sample_sizes": sample_sizes,
            "pairs": pairs,
            "overall_confident": overall,
        }
    finally:
        session.close()
