"""Kullanıcının kayıtlı kart bilgisi (yalnızca son 4 hane — tam PAN/CVV saklanmaz)."""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserPaymentCard(Base):
    __tablename__ = "user_payment_cards"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "last_four",
            "exp_month",
            "exp_year",
            name="uq_user_payment_cards_user_last_exp",
        ),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    last_four = Column(String(4), nullable=False)
    holder_name = Column(String(120), nullable=False)
    exp_month = Column(SmallInteger, nullable=False)
    exp_year = Column(SmallInteger, nullable=False)
    brand = Column(String(20), nullable=False)
    label = Column(String(80), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="payment_cards")
