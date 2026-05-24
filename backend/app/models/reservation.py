"""Reservation modeli - park yeri rezervasyonu."""
from sqlalchemy import Column, Integer, DateTime, ForeignKey, String, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import enum

from app.core.database import Base

RESERVATION_DURATION_MINUTES = 30
ENTRY_GRACE_AFTER_SCHEDULED_MINUTES = 10


class ReservationStatus(str, enum.Enum):
    active = "active"
    used = "used"
    expired = "expired"
    cancelled = "cancelled"


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    spot_id = Column(Integer, ForeignKey("spots.id"), nullable=False)
    reserved_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(minutes=RESERVATION_DURATION_MINUTES),
        nullable=False,
    )
    scheduled_start_at = Column(DateTime, nullable=True)
    entry_deadline_at = Column(DateTime, nullable=True)
    status = Column(SQLEnum(ReservationStatus), default=ReservationStatus.active, nullable=False)
    plate_number = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="reservations")
    spot = relationship("Spot", back_populates="reservations")
