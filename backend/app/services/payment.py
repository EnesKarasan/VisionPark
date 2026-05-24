"""Simüle ödeme — gerçek ödeme sağlayıcısı yok; park bitişinde otomatik tamamlanır."""
from sqlalchemy.orm import Session

from app.models import Payment, UserPaymentCard
from app.models.payment import PaymentStatus
from app.models.parking_session import ParkingSession

PROVIDER_SIMULATED = "simulated"


def record_completed_payment(db: Session, session: ParkingSession, user_id: int) -> Payment | None:
    """
    Tamamlanmış ödeme kaydı oluşturur veya günceller.
    Ücret 0 olsa bile (örn. ücretsiz dilim içinde çıkış) kart bilgisi kaydı için
    payment record üretilir; bu sayede admin tablosunda kullanıcının kartı görüntülenebilir.
    """
    if session.total_fee is None:
        return None

    existing = db.query(Payment).filter(Payment.session_id == session.id).first()
    if existing and existing.status == PaymentStatus.completed:
        return existing

    card = (
        db.query(UserPaymentCard)
        .filter(UserPaymentCard.user_id == user_id)
        .order_by(UserPaymentCard.created_at.desc())
        .first()
    )
    last4 = card.last_four if card else None
    brand = card.brand if card else None

    if existing:
        existing.amount = session.total_fee
        existing.status = PaymentStatus.completed
        existing.provider = PROVIDER_SIMULATED
        if last4:
            existing.card_last_four = last4
        if brand:
            existing.card_brand = brand
        return existing

    payment = Payment(
        session_id=session.id,
        amount=session.total_fee,
        status=PaymentStatus.completed,
        provider=PROVIDER_SIMULATED,
        card_last_four=last4,
        card_brand=brand,
    )
    db.add(payment)
    return payment
