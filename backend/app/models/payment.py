"""Payment modeli - ödeme kaydı."""
from sqlalchemy import Column, Integer, DateTime, Numeric, ForeignKey, String, Enum as SQLEnum, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"
    refunded = "refunded"
    cancelled = "cancelled"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("parking_sessions.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="TRY", nullable=False)
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.pending, nullable=False)
    provider = Column(String(50), nullable=True)  # simulated
    provider_ref = Column(String(255), nullable=True)
    provider_response = Column(Text, nullable=True)
    card_last_four = Column(String(4), nullable=True)
    card_brand = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    session = relationship("ParkingSession", back_populates="payment")
