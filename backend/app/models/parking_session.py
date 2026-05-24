"""ParkingSession modeli - park oturumu."""
from sqlalchemy import Column, Integer, DateTime, Numeric, ForeignKey, String, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class SessionStatus(str, enum.Enum):
    active = "active"
    ended = "ended"
    cancelled = "cancelled"


class ParkingSession(Base):
    __tablename__ = "parking_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    spot_id = Column(Integer, ForeignKey("spots.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    total_fee = Column(Numeric(10, 2), nullable=True)
    status = Column(SQLEnum(SessionStatus), default=SessionStatus.active, nullable=False)
    plate_number = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="parking_sessions")
    spot = relationship("Spot", back_populates="parking_sessions")
    payment = relationship("Payment", back_populates="session", uselist=False)
