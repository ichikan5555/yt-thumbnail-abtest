"""Multi-metric analysis and weighted winner determination."""

import json
import logging
from dataclasses import dataclass, field

from app.database import get_session
from app.models import ABTest, Measurement, Variant, VariantAnalytics

logger = logging.getLogger(__name__)

DEFAULT_WEIGHTS = {
    "view_velocity": 5,
    "impressions": 2,
    "ctr": 5,
    "avg_view_duration": 4,
    "avg_view_percentage": 3,
    "watch_time": 2,
    "likes": 2,
    "shares": 1,
    "comments": 1,
}

METRIC_LABELS = {
    "view_velocity": "View Velocity (views/h)",
    "impressions": "Impressions",
    "ctr": "CTR (%)",
    "avg_view_duration": "Avg View Duration (s)",
    "avg_view_percentage": "Avg View %",
    "watch_time": "Watch Time (min)",
    "likes": "Likes",
    "shares": "Shares",
    "comments": "Comments",
}


@dataclass
class MetricScore:
    """Per-metric normalized score (0-100) for a variant."""
    raw_value: float = 0.0
    normalized: float = 0.0  # 0-100 normalized against all variants
    weighted: float = 0.0    # normalized * weight


@dataclass
class VariantResult:
    variant_id: int
    label: str
    avg_velocity: float
    measurement_count: int
    total_views_gained: int
    composite_score: float = 0.0
    is_winner: bool = False
    improvement_pct: float = 0.0
    metrics: dict[str, MetricScore] = field(default_factory=dict)


@dataclass
class TestResult:
    test_id: int
    video_id: str
    video_title: str
    winner: VariantResult
    variants: list[VariantResult]
    weights: dict[str, int] = field(default_factory=dict)
    has_analytics: bool = False


class Analyzer:
    def determine_winner(self, test_id: int) -> TestResult:
        """Analyze measurements + analytics and determine winner via weighted scoring."""
        session = get_session()
        try:
            test = session.get(ABTest, test_id)
            variants = session.query(Variant).filter_by(ab_test_id=test_id).all()

            # Get weights
            weights = DEFAULT_WEIGHTS.copy()
            if test.metric_weights:
                try:
                    weights.update(json.loads(test.metric_weights))
                except (json.JSONDecodeError, TypeError):
                    pass

            # Get analytics data if available
            analytics: dict[int, VariantAnalytics] = {}
            va_rows = session.query(VariantAnalytics).filter_by(ab_test_id=test_id).all()
            for va in va_rows:
                analytics[va.variant_id] = va
            has_analytics = bool(analytics)

            # Build variant results with raw metrics
            results: list[VariantResult] = []
            for v in variants:
                measurements = (
                    session.query(Measurement)
                    .filter_by(variant_id=v.id)
                    .filter(Measurement.velocity.isnot(None))
                    .all()
                )
                total_views = sum(
                    (m.view_count_end - m.view_count_start)
                    for m in measurements
                    if m.view_count_end is not None
                )

                va = analytics.get(v.id)
                vr = VariantResult(
                    variant_id=v.id,
                    label=v.label,
                    avg_velocity=v.avg_velocity,
                    measurement_count=v.measurement_count,
                    total_views_gained=total_views,
                )
                # Raw metric values
                vr.metrics = {
                    "view_velocity": MetricScore(raw_value=v.avg_velocity),
                    "impressions": MetricScore(raw_value=va.impressions if va else 0),
                    "ctr": MetricScore(raw_value=va.ctr if va else 0),
                    "avg_view_duration": MetricScore(raw_value=va.avg_view_duration if va else 0),
                    "avg_view_percentage": MetricScore(raw_value=va.avg_view_percentage if va else 0),
                    "watch_time": MetricScore(raw_value=va.estimated_minutes_watched if va else 0),
                    "likes": MetricScore(raw_value=va.likes if va else 0),
                    "shares": MetricScore(raw_value=va.shares if va else 0),
                    "comments": MetricScore(raw_value=va.comments if va else 0),
                }
                results.append(vr)

            # Normalize each metric across variants (0-100)
            for metric_key in weights:
                values = [r.metrics[metric_key].raw_value for r in results]
                max_val = max(values) if values else 0
                for r in results:
                    ms = r.metrics[metric_key]
                    if max_val > 0:
                        ms.normalized = (ms.raw_value / max_val) * 100
                    else:
                        ms.normalized = 0

            # Calculate weighted composite score
            total_weight = sum(
                w for k, w in weights.items()
                if w > 0 and (k == "view_velocity" or has_analytics)
            )
            if total_weight == 0:
                total_weight = weights.get("view_velocity", 1)

            for r in results:
                score = 0.0
                for metric_key, weight in weights.items():
                    if weight == 0:
                        continue
                    if metric_key != "view_velocity" and not has_analytics:
                        continue
                    ms = r.metrics[metric_key]
                    ms.weighted = ms.normalized * weight / total_weight
                    score += ms.weighted
                r.composite_score = score

            # Sort by composite score
            results.sort(key=lambda r: r.composite_score, reverse=True)

            winner = results[0]
            winner.is_winner = True

            # Improvement percentages
            worst_score = results[-1].composite_score
            for r in results:
                if worst_score > 0:
                    r.improvement_pct = (
                        (r.composite_score - worst_score) / worst_score * 100
                    )

            return TestResult(
                test_id=test.id,
                video_id=test.video_id,
                video_title=test.video_title,
                winner=winner,
                variants=results,
                weights=weights,
                has_analytics=has_analytics,
            )
        finally:
            session.close()

    def format_result_message(self, result: TestResult) -> str:
        """Format test result as a human-readable message with metrics."""
        lines = [
            f"テスト完了 - 勝者: {result.winner.label}",
            f"動画: {result.video_title}",
            "",
            "【総合スコア】",
        ]
        for v in result.variants:
            marker = " ← 勝者" if v.is_winner else ""
            pct = f" (+{v.improvement_pct:.1f}%)" if v.improvement_pct > 0 else ""
            lines.append(f"  {v.label}: {v.composite_score:.1f} pts{pct}{marker}")

        lines.append("")
        lines.append("【指標詳細】")

        # Header
        labels = [v.label for v in result.variants]
        header = f"  {'指標':<20s}" + "".join(f"{l:>10s}" for l in labels)
        lines.append(header)
        lines.append("  " + "-" * (20 + 10 * len(labels)))

        metric_display = [
            ("view_velocity", "views/h", 1),
            ("avg_view_duration", "秒", 1),
            ("avg_view_percentage", "%", 1),
            ("watch_time", "分", 1),
            ("likes", "", 0),
            ("shares", "", 0),
            ("comments", "", 0),
        ]
        for key, unit, decimals in metric_display:
            label = METRIC_LABELS.get(key, key)[:18]
            values = ""
            for v in result.variants:
                ms = v.metrics.get(key)
                if ms:
                    if decimals:
                        values += f"{ms.raw_value:>8.{decimals}f}{unit:>2s}"
                    else:
                        values += f"{ms.raw_value:>8.0f}{unit:>2s}"
                else:
                    values += f"{'N/A':>10s}"
            lines.append(f"  {label:<20s}{values}")

        lines.append("")
        lines.append(f"サムネイル {result.winner.label} を固定設定しました。")
        return "\n".join(lines)


analyzer = Analyzer()
