"""Kullanıcıya kayıtlı araçlar (plaka)."""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserVehicle(Base):
    __tablename__ = "user_vehicles"
    __table_args__ = (UniqueConstraint("user_id", "plate", name="uq_user_vehicles_user_plate"),)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plate = Column(String(32), nullable=False)
    label = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="vehicles")
