"""Şifre sıfırlama e-posta doğrulama kayıtları."""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.core.database import Base


class PasswordResetVerification(Base):
    __tablename__ = "password_reset_verifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), nullable=False, index=True)
    code_hash = Column(String(128), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
    attempt_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
