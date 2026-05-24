"""ParkingIntent - kullanıcının QR ile giriş yapma niyeti.

Mobil uygulamada park-now akışı tamamlandığında oluşturulur. Kısa ömürlü,
tek kullanımlık. QR'a sadece bu token gömülür; spot/user bilgisi backend'de
saklanır, böylece QR çalınsa bile başka bilgi açığa çıkmaz.
"""
import enum
from datetime import datetime, timedelta

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.core.database import Base

PARKING_INTENT_TTL_MINUTES = 10


class ParkingIntentKind(str, enum.Enum):
    entry = "entry"
    exit = "exit"


class ParkingIntent(Base):
    __tablename__ = "parking_intents"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(64), unique=True, nullable=False, index=True)
    kind = Column(
        SQLEnum(ParkingIntentKind, name="parking_intent_kind"),
        nullable=False,
        default=ParkingIntentKind.entry,
    )
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    spot_id = Column(Integer, ForeignKey("spots.id"), nullable=False)
    plate_number = Column(String(20), nullable=True)
    expires_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(minutes=PARKING_INTENT_TTL_MINUTES),
        nullable=False,
    )
    consumed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")
    spot = relationship("Spot")
