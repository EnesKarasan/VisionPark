"""Reservation API - park yeri rezervasyonu."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Spot, User, Reservation
from app.models.reservation import (
    ReservationStatus,
    RESERVATION_DURATION_MINUTES,
    ENTRY_GRACE_AFTER_SCHEDULED_MINUTES,
)
from app.schemas.reservation import ReservationCreate, ReservationResponse
from app.api.deps import get_current_user
from app.services.user_account import delete_customer_user

router = APIRouter(prefix="/reservations", tags=["reservations"])


def _reservation_response(r: Reservation) -> ReservationResponse:
    resp = ReservationResponse.model_validate(r)
    resp.spot_number = r.spot.spot_number if r.spot else None
    return resp


def _to_naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _spot_free_if_no_other_active(db: Session, spot_id: int, exclude_reservation_id: int) -> None:
    spot = db.query(Spot).filter(Spot.id == spot_id).first()
    if not spot:
        return
    has_other = (
        db.query(Reservation)
        .filter(
            Reservation.spot_id == spot_id,
            Reservation.status == ReservationStatus.active,
            Reservation.id != exclude_reservation_id,
        )
        .first()
    )
    if not has_other:
        spot.is_reserved = False


def _expire_stale_reservations(db: Session):
    """Süresi dolmuş aktif rezervasyonları kapatır; planlı rezervasyonda ihlal sayacı uygular."""
    now = datetime.utcnow()
    stale = (
        db.query(Reservation)
        .filter(
            Reservation.status == ReservationStatus.active,
            Reservation.expires_at <= now,
        )
        .all()
    )
    for r in stale:
        if r.scheduled_start_at is not None:
            user = db.query(User).filter(User.id == r.user_id).first()
            if not user:
                r.status = ReservationStatus.expired
                _spot_free_if_no_other_active(db, r.spot_id, r.id)
                continue
            user.missed_reservation_entry_count += 1
            r.status = ReservationStatus.expired
            _spot_free_if_no_other_active(db, r.spot_id, r.id)
            if user.missed_reservation_entry_count >= 2:
                delete_customer_user(db, user)
        else:
            r.status = ReservationStatus.expired
            _spot_free_if_no_other_active(db, r.spot_id, r.id)
    if stale:
        db.commit()


@router.post("", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
def create_reservation(
    data: ReservationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Yeni rezervasyon: planlı (bugün + saat) veya eski 30 dk modu (scheduled_start_at yok)."""
    _expire_stale_reservations(db)

    spot = db.query(Spot).filter(Spot.id == data.spot_id).first()
    if not spot:
        raise HTTPException(status_code=404, detail="Park yeri bulunamadı")
    if spot.is_occupied:
        raise HTTPException(status_code=400, detail="Bu park yeri şu anda dolu")
    if spot.is_reserved:
        raise HTTPException(status_code=400, detail="Bu park yeri zaten rezerve edilmiş")

    existing = (
        db.query(Reservation)
        .filter(
            Reservation.user_id == user.id,
            Reservation.status == ReservationStatus.active,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Zaten aktif bir rezervasyonunuz var")

    now = datetime.utcnow()

    if data.scheduled_start_at is not None:
        sched = _to_naive_utc(data.scheduled_start_at)
        if sched.date() != now.date():
            raise HTTPException(
                status_code=400,
                detail="Rezervasyon saati yalnızca bugün (UTC) için seçilebilir.",
            )
        if sched <= now:
            raise HTTPException(
                status_code=400,
                detail="Rezervasyon saati gelecekte olmalıdır.",
            )
        entry_deadline = sched + timedelta(minutes=ENTRY_GRACE_AFTER_SCHEDULED_MINUTES)
        reservation = Reservation(
            user_id=user.id,
            spot_id=data.spot_id,
            plate_number=data.plate_number,
            reserved_at=now,
            expires_at=entry_deadline,
            scheduled_start_at=sched,
            entry_deadline_at=entry_deadline,
            status=ReservationStatus.active,
        )
    else:
        reservation = Reservation(
            user_id=user.id,
            spot_id=data.spot_id,
            plate_number=data.plate_number,
            reserved_at=now,
            expires_at=now + timedelta(minutes=RESERVATION_DURATION_MINUTES),
            scheduled_start_at=None,
            entry_deadline_at=None,
            status=ReservationStatus.active,
        )

    spot.is_reserved = True
    db.add(reservation)
    db.commit()
    db.refresh(reservation)

    return _reservation_response(reservation)


@router.delete("/{reservation_id}", status_code=status.HTTP_200_OK)
def cancel_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Rezervasyonu iptal et."""
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Rezervasyon bulunamadı")
    if reservation.user_id != user.id:
        raise HTTPException(status_code=403, detail="Bu rezervasyon size ait değil")
    if reservation.status != ReservationStatus.active:
        raise HTTPException(status_code=400, detail="Bu rezervasyon zaten aktif değil")

    reservation.status = ReservationStatus.cancelled
    spot = db.query(Spot).filter(Spot.id == reservation.spot_id).first()
    if spot:
        spot.is_reserved = False
    db.commit()
    return {"detail": "Rezervasyon iptal edildi"}


@router.get("/my", response_model=list[ReservationResponse])
def my_reservations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kullanıcının rezervasyonları."""
    _expire_stale_reservations(db)
    reservations = (
        db.query(Reservation)
        .filter(Reservation.user_id == user.id)
        .order_by(Reservation.reserved_at.desc())
        .limit(50)
        .all()
    )
    return [_reservation_response(r) for r in reservations]


@router.get("/active", response_model=ReservationResponse | None)
def active_reservation(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Aktif rezervasyon varsa döner."""
    _expire_stale_reservations(db)
    reservation = (
        db.query(Reservation)
        .filter(
            Reservation.user_id == user.id,
            Reservation.status == ReservationStatus.active,
        )
        .first()
    )
    if not reservation:
        return None
    return _reservation_response(reservation)
