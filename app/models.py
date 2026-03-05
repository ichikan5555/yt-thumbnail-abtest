"""SQLAlchemy ORM models."""

import enum
from datetime import datetime, timedelta

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class TestStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ERROR = "error"
    DAILY_PAUSED = "daily_paused"


class ABTest(Base):
    __tablename__ = "ab_tests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    video_id = Column(String(20), nullable=False, index=True)
    video_title = Column(String(500), default="")
    status = Column(Enum(TestStatus), default=TestStatus.PENDING, nullable=False)
    cycles = Column(Integer, nullable=False, default=2)
    current_cycle = Column(Integer, default=0)
    current_variant_index = Column(Integer, default=0)
    rotation_order = Column(Text, default="")  # JSON: e.g. '["A","C","B"]'
    rotation_interval = Column(Integer, nullable=False, default=30)  # minutes per rotation
    scheduled_start = Column(DateTime, nullable=True)   # when to start (None=immediately)
    scheduled_end = Column(DateTime, nullable=True)     # when to finalize winner
    metric_weights = Column(Text, default="")  # JSON: {"view_velocity":5,"ctr":5,...}
    winner_variant_id = Column(Integer, ForeignKey("variants.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    analytics_fetched_at = Column(DateTime, nullable=True)

    # Multi-day test fields (Feature 3)
    test_mode = Column(String(20), default="single")          # single | multi_day
    scheduled_days = Column(Text, default="")                  # JSON: ["2026-03-05","2026-03-07"]
    daily_start_time = Column(String(5), default="")           # "14:00"
    current_day_index = Column(Integer, default=0)
    total_days = Column(Integer, default=1)

    # Degradation tracking (Feature 4)
    degradation_tracking = Column(Integer, default=1)          # 1=on, 0=off
    degradation_alert = Column(Text, nullable=True)

    # Multi-tenant
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    variants = relationship("Variant", back_populates="ab_test", foreign_keys="Variant.ab_test_id")
    measurements = relationship("Measurement", back_populates="ab_test")
    winner = relationship("Variant", foreign_keys=[winner_variant_id], post_update=True)


class Variant(Base):
    __tablename__ = "variants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ab_test_id = Column(Integer, ForeignKey("ab_tests.id"), nullable=False)
    label = Column(String(1), nullable=False)  # A, B, C
    image_path = Column(String(1000), nullable=False)
    total_velocity = Column(Float, default=0.0)
    measurement_count = Column(Integer, default=0)
    thumbnail_categories = Column(Text, default="")            # JSON: ["human_face","text_heavy"]
    categories_analyzed_at = Column(DateTime, nullable=True)

    ab_test = relationship("ABTest", back_populates="variants", foreign_keys=[ab_test_id])
    measurements = relationship("Measurement", back_populates="variant")

    @property
    def avg_velocity(self) -> float:
        if self.measurement_count == 0:
            return 0.0
        return self.total_velocity / self.measurement_count


class Measurement(Base):
    __tablename__ = "measurements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ab_test_id = Column(Integer, ForeignKey("ab_tests.id"), nullable=False)
    variant_id = Column(Integer, ForeignKey("variants.id"), nullable=False)
    cycle = Column(Integer, nullable=False)
    view_count_start = Column(Integer, nullable=False)
    view_count_end = Column(Integer, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Float, nullable=True)
    velocity = Column(Float, nullable=True)  # views/hour

    ab_test = relationship("ABTest", back_populates="measurements")
    variant = relationship("Variant", back_populates="measurements")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ab_test_id = Column(Integer, ForeignKey("ab_tests.id"), nullable=False)
    channel = Column(String(20), nullable=False)  # chatwork, email
    event = Column(String(50), nullable=False)  # start, rotation, complete, error
    message = Column(Text, nullable=False)
    success = Column(Integer, default=1)  # 1=success, 0=failure
    sent_at = Column(DateTime, default=datetime.utcnow)
    error_detail = Column(Text, nullable=True)


class VariantAnalytics(Base):
    """Analytics API data per variant (fetched after test)."""
    __tablename__ = "variant_analytics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ab_test_id = Column(Integer, ForeignKey("ab_tests.id"), nullable=False)
    variant_id = Column(Integer, ForeignKey("variants.id"), nullable=False)
    impressions = Column(Float, default=0)
    ctr = Column(Float, default=0)            # click-through rate (0-1)
    avg_view_duration = Column(Float, default=0)  # seconds
    avg_view_percentage = Column(Float, default=0)  # 0-100
    estimated_minutes_watched = Column(Float, default=0)
    likes = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    fetched_at = Column(DateTime, default=datetime.utcnow)

    variant = relationship("Variant")


class QuotaLog(Base):
    __tablename__ = "quota_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    operation = Column(String(50), nullable=False)
    units = Column(Integer, nullable=False)
    ab_test_id = Column(Integer, ForeignKey("ab_tests.id"), nullable=True)
    user_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True)
    key = Column(String(100), nullable=False, index=True)
    value = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255), default="")
    password_hash = Column(String(255), nullable=True)  # null for 2FA-only users
    auth_method = Column(String(20), nullable=False, default="password")  # password | 2fa_chatwork | 2fa_email
    chatwork_room_id = Column(String(50), nullable=True)
    chatwork_api_token = Column(String(255), nullable=True)
    plan = Column(String(20), nullable=False, default="standard")  # standard | pro
    trial_ends_at = Column(DateTime, nullable=True)  # free trial expiry (14 days from registration)
    # YouTube OAuth2 per-user
    youtube_client_id = Column(String(255), nullable=True)
    youtube_client_secret = Column(String(255), nullable=True)
    youtube_token = Column(Text, nullable=True)       # OAuth2 token JSON
    youtube_connected_at = Column(DateTime, nullable=True)
    youtube_channel_title = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def trial_active(self) -> bool:
        if self.plan == "pro":
            return False
        if not self.trial_ends_at:
            return False
        return datetime.utcnow() < self.trial_ends_at

    @property
    def trial_days_left(self) -> int:
        if not self.trial_ends_at:
            return 0
        delta = self.trial_ends_at - datetime.utcnow()
        return max(0, delta.days)


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class DegradationCheck(Base):
    """Post-test daily performance check (Feature 4)."""
    __tablename__ = "degradation_checks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ab_test_id = Column(Integer, ForeignKey("ab_tests.id"), nullable=False)
    day_number = Column(Integer, nullable=False)         # 1-30
    view_count = Column(Integer, nullable=False)
    daily_views = Column(Integer, default=0)
    velocity_24h = Column(Float, default=0.0)
    checked_at = Column(DateTime, default=datetime.utcnow)

    ab_test = relationship("ABTest")


class CompetitorAnalysis(Base):
    """Competitor channel analysis (Feature 6)."""
    __tablename__ = "competitor_analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True)
    channel_id = Column(String(50), nullable=False)
    channel_title = Column(String(500), default="")
    video_count = Column(Integer, default=0)
    analysis_result = Column(Text, default="")           # JSON
    created_at = Column(DateTime, default=datetime.utcnow)
