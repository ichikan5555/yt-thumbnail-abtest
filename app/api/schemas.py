"""Pydantic request/response schemas for the API."""

from datetime import datetime

from pydantic import BaseModel


# --- Variants ---

class VariantOut(BaseModel):
    id: int
    label: str
    image_path: str
    thumbnail_url: str | None = None
    avg_velocity: float
    measurement_count: int

    model_config = {"from_attributes": True}


# --- Measurements ---

class MeasurementOut(BaseModel):
    id: int
    variant_id: int
    variant_label: str | None = None
    cycle: int
    view_count_start: int
    view_count_end: int | None
    started_at: datetime | None
    ended_at: datetime | None
    duration_minutes: float | None
    velocity: float | None

    model_config = {"from_attributes": True}


# --- Tests ---

class TestSummary(BaseModel):
    id: int
    video_id: str
    video_title: str
    status: str
    current_cycle: int
    cycles: int
    rotation_interval: int
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    winner_label: str | None = None
    created_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    test_mode: str = "single"
    current_day_index: int = 0
    total_days: int = 1

    model_config = {"from_attributes": True}


class TestDetail(BaseModel):
    id: int
    video_id: str
    video_title: str
    status: str
    cycles: int
    current_cycle: int
    current_variant_index: int
    rotation_order: str
    rotation_interval: int
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    winner_variant_id: int | None
    created_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    variants: list[VariantOut]
    measurements: list[MeasurementOut]
    test_mode: str = "single"
    scheduled_days: str = ""
    daily_start_time: str = ""
    current_day_index: int = 0
    total_days: int = 1

    model_config = {"from_attributes": True}


# --- Results ---

class MetricScoreOut(BaseModel):
    raw_value: float
    normalized: float
    weighted: float


class VariantResultOut(BaseModel):
    variant_id: int
    label: str
    avg_velocity: float
    measurement_count: int
    total_views_gained: int
    composite_score: float
    is_winner: bool
    improvement_pct: float
    metrics: dict[str, MetricScoreOut]


class TestResultOut(BaseModel):
    test_id: int
    video_id: str
    video_title: str
    winner: VariantResultOut
    variants: list[VariantResultOut]
    weights: dict[str, int]
    has_analytics: bool


class AnalyticsOut(BaseModel):
    """Per-variant analytics data."""
    label: str
    impressions: float
    ctr: float
    avg_view_duration: float
    avg_view_percentage: float
    estimated_minutes_watched: float
    likes: int
    shares: int
    comments: int


# --- Quota ---

class QuotaOut(BaseModel):
    used: int
    limit: int
    remaining: int
    pct: float
    est_tests_possible: int


# --- SSE ---

class TestEvent(BaseModel):
    test_id: int
    status: str
    current_cycle: int
    current_variant_index: int
    variants: list[VariantOut]


# --- Settings ---

class SettingsOut(BaseModel):
    default_rotation_interval: int = 30
    default_cycles: int = 1
    default_num_patterns: int = 3
    default_start_time: str = ""
    default_metric_weights: dict[str, int] = {}
    notification_channels: list[str] = ["chatwork", "email", "slack"]


class SettingsUpdate(BaseModel):
    default_rotation_interval: int | None = None
    default_cycles: int | None = None
    default_num_patterns: int | None = None
    default_start_time: str | None = None
    default_metric_weights: dict[str, int] | None = None
    notification_channels: list[str] | None = None


# --- Heatmap (Feature 1) ---

class HeatmapCell(BaseModel):
    weekday: int       # 0=Mon, 6=Sun
    hour: int          # 0-23
    avg_velocity: float

class VariantHeatmap(BaseModel):
    label: str
    cells: list[HeatmapCell]

class HeatmapOut(BaseModel):
    test_id: int
    variants: list[VariantHeatmap]


# --- Statistical Significance (Feature 2) ---

class PairComparison(BaseModel):
    variant_a: str
    variant_b: str
    p_value: float
    confidence_pct: float
    significant: bool
    better_variant: str

class SignificanceOut(BaseModel):
    test_id: int
    sample_sizes: dict[str, int]
    pairs: list[PairComparison]
    overall_confident: bool


# --- Degradation (Feature 4) ---

class DegradationCheckOut(BaseModel):
    day_number: int
    view_count: int
    daily_views: int
    velocity_24h: float
    checked_at: datetime | None

    model_config = {"from_attributes": True}

class DegradationOut(BaseModel):
    test_id: int
    tracking_enabled: bool
    alert: str | None
    avg_test_velocity: float
    checks: list[DegradationCheckOut]
