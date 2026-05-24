"""User modeli."""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    operator = "operator"
    customer = "customer"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    birth_date = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    role = Column(SQLEnum(UserRole), default=UserRole.customer, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    missed_reservation_entry_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    parking_sessions = relationship("ParkingSession", back_populates="user")
    reservations = relationship("Reservation", back_populates="user")
    vehicles = relationship("UserVehicle", back_populates="user", cascade="all, delete-orphan")
    payment_cards = relationship("UserPaymentCard", back_populates="user", cascade="all, delete-orphan")
