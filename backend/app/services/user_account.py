"""Tam müşteri hesabı silme (FK sırası)."""
from sqlalchemy.orm import Session

from app.models import Payment, ParkingSession, Reservation, User, UserPaymentCard, UserVehicle


def delete_customer_user(db: Session, user: User) -> None:
    """Kullanıcıyı ve bağlı tüm müşteri verilerini siler."""
    uid = user.id
    sessions = db.query(ParkingSession.id).filter(ParkingSession.user_id == uid).all()
    sids = [row[0] for row in sessions]
    if sids:
        db.query(Payment).filter(Payment.session_id.in_(sids)).delete(synchronize_session=False)
    db.query(ParkingSession).filter(ParkingSession.user_id == uid).delete(synchronize_session=False)
    db.query(Reservation).filter(Reservation.user_id == uid).delete(synchronize_session=False)
    db.query(UserVehicle).filter(UserVehicle.user_id == uid).delete(synchronize_session=False)
    db.query(UserPaymentCard).filter(UserPaymentCard.user_id == uid).delete(synchronize_session=False)
    db.delete(user)
