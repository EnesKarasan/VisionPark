"""Pricing modeli - ücretlendirme."""
from sqlalchemy import Column, Integer, Numeric, ForeignKey, DateTime, String, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class Pricing(Base):
    __tablename__ = "pricing"

    id = Column(Integer, primary_key=True, index=True)
    parking_lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, unique=True)
    hourly_rate = Column(Numeric(10, 2), default=0, nullable=False)
    first_hour_rate = Column(Numeric(10, 2), nullable=True)  # İlk saat farklı
    min_charge_minutes = Column(Integer, default=60, nullable=False)  # Eski şema; yeni tarifede kullanılmıyor
    currency = Column(String(3), default="TRY", nullable=False)
    pricing_rules = Column(JSON, nullable=True)  # { "free_minutes", "brackets": [...] }
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    parking_lot = relationship("ParkingLot", back_populates="pricing")
