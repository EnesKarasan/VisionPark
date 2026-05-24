"""Spot modeli - park yeri."""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class Spot(Base):
    __tablename__ = "spots"

    id = Column(Integer, primary_key=True, index=True)
    parking_lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False)
    spot_number = Column(String(20), nullable=False)  # Örn: "A-101"
    bbox = Column(JSON, nullable=False)  # [x, y, w, h]
    is_occupied = Column(Boolean, default=False, nullable=False)
    is_reserved = Column(Boolean, default=False, nullable=False)
    mask_index = Column(Integer, nullable=True)
    section = Column(String(50), nullable=True)  # Bölüm: "A", "B", "C" vb.
    row_number = Column(Integer, nullable=True)  # Sıra numarası: 1, 2, 3 vb.
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    parking_lot = relationship("ParkingLot", back_populates="spots")
    parking_sessions = relationship("ParkingSession", back_populates="spot")
    reservations = relationship("Reservation", back_populates="spot")
