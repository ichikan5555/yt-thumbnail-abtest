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
