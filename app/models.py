"""SQLAlchemy ORM models."""

import enum
from datetime import datetime, timedelta

from sqlalchemy import (
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
    created_at = Column(DateTime, default=datetime.utcnow)


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), nullable=False, unique=True, index=True)
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
    plan = Column(String(20), nullable=False, default="standard")  # standard | pro
    trial_ends_at = Column(DateTime, nullable=True)  # free trial expiry (14 days from registration)
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
