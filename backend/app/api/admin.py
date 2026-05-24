"""Admin API - istatistikler, oturumlar, park alanı yönetimi."""
import sqlite3
import shutil
import tempfile
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path as FsPath
from typing import Literal

from fastapi import APIRouter, Depends, Query, HTTPException, Path, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.core.database import get_db, engine, SessionLocal
from app.core.config import get_settings
from app.core.logging_config import get_logger
from app.models import Spot, ParkingSession, ParkingLot, Payment, Reservation, Pricing
from app.models.parking_session import SessionStatus
from app.models.payment import PaymentStatus
from app.api.deps import get_current_admin, get_current_staff
from app.models import User
from app.schemas.spot import SpotResponse, SpotBulkSave, SpotUpdate
from app.schemas.reservation import ReservationResponse
from app.schemas.pricing import PricingResponse, PricingUpdate
from app.schemas.user import AdminUserRow, AdminUserCreate, AdminUserUpdate
from app.services.parking_fee import resolved_pricing_rules, get_lot_pricing_rules, rules_for_api_response
from app.core.security import get_password_hash
from app.models.user import UserRole

_logger = get_logger("admin.backup")

router = APIRouter(prefix="/admin", tags=["admin"])


def _customer_name(u: User) -> str:
    if u.full_name and str(u.full_name).strip():
        return str(u.full_name).strip()
    parts = [p for p in (u.first_name, u.last_name) if p]
    if parts:
        return " ".join(parts)
    return u.email or ""


def _payment_dict(p: Payment | None) -> dict | None:
    if not p:
        return None
    st = p.status.value if hasattr(p.status, "value") else p.status
    return {
        "id": p.id,
        "amount": float(p.amount),
        "status": st,
        "provider": p.provider,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "card_last_four": p.card_last_four,
        "card_brand": p.card_brand,
    }


def _parse_optional_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        v = value.strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(v)
        if dt.tzinfo is not None:
            dt = dt.replace(tzinfo=None)
        return dt
    except ValueError:
        raise HTTPException(status_code=400, detail="Geçersiz tarih formatı (ISO 8601 kullanın)")


def _bucket_label_utc(dt: datetime, granularity: str) -> str:
    y, w, _ = dt.isocalendar()
    if granularity == "daily":
        return dt.strftime("%Y-%m-%d")
    if granularity == "weekly":
        return f"{y}-W{w:02d}"
    if granularity == "monthly":
        return dt.strftime("%Y-%m")
    if granularity == "yearly":
        return dt.strftime("%Y")
    raise HTTPException(status_code=400, detail="granularity geçersiz")


def _default_range_days(granularity: str) -> int:
    return {"daily": 30, "weekly": 84, "monthly": 365, "yearly": 1825}.get(granularity, 30)


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
):
    """Dashboard istatistikleri (admin + operatör)."""
    lot = db.query(ParkingLot).filter(ParkingLot.is_active).first()
    if not lot:
        return {
            "total_spots": 0,
            "available": 0,
            "occupied": 0,
            "active_sessions": 0,
            "today_revenue": 0,
        }
    spots = db.query(Spot).filter(Spot.parking_lot_id == lot.id).all()
    available = sum(1 for s in spots if not s.is_occupied)
    active_sessions = db.query(ParkingSession).filter(
        ParkingSession.spot.has(parking_lot_id=lot.id),
        ParkingSession.status == "active",
    ).count()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_revenue_q = db.query(func.coalesce(func.sum(Payment.amount), 0)).join(
        ParkingSession, Payment.session_id == ParkingSession.id
    ).join(Spot, ParkingSession.spot_id == Spot.id).filter(
        Spot.parking_lot_id == lot.id,
        Payment.status == "completed",
        Payment.created_at >= today_start,
    )
    today_revenue = float(today_revenue_q.scalar() or 0)
    return {
        "total_spots": len(spots),
        "available": available,
        "occupied": len(spots) - available,
        "active_sessions": active_sessions,
        "today_revenue": float(today_revenue),
    }


@router.get("/sessions")
def list_sessions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None),
    started_after: str | None = Query(None),
    started_before: str | None = Query(None),
):
    """Tüm park oturumları (müşteri ve ödeme özeti dahil)."""
    lot = db.query(ParkingLot).filter(ParkingLot.is_active).first()
    if not lot:
        return []
    q = (
        db.query(ParkingSession)
        .options(
            joinedload(ParkingSession.user),
            joinedload(ParkingSession.spot),
            joinedload(ParkingSession.payment),
        )
        .join(Spot, ParkingSession.spot_id == Spot.id)
        .filter(Spot.parking_lot_id == lot.id)
    )
    if status:
        try:
            st_enum = SessionStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail="Geçersiz durum filtresi")
        q = q.filter(ParkingSession.status == st_enum)
    sa_dt = _parse_optional_datetime(started_after)
    if sa_dt is not None:
        q = q.filter(ParkingSession.started_at >= sa_dt)
    sb_dt = _parse_optional_datetime(started_before)
    if sb_dt is not None:
        q = q.filter(ParkingSession.started_at <= sb_dt)
    sessions = (
        q.order_by(ParkingSession.started_at.desc()).offset(offset).limit(limit).all()
    )
    out = []
    for s in sessions:
        u = s.user
        st = s.status.value if hasattr(s.status, "value") else s.status
        out.append(
            {
                "id": s.id,
                "user_id": s.user_id,
                "spot_id": s.spot_id,
                "spot_number": s.spot.spot_number,
                "started_at": s.started_at.isoformat(),
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                "total_fee": float(s.total_fee) if s.total_fee else None,
                "status": st,
                "plate_number": s.plate_number,
                "customer_name": _customer_name(u) if u else "",
                "customer_email": u.email if u else "",
                "payment": _payment_dict(s.payment),
            }
        )
    return out


@router.get("/reports/timeseries")
def reports_timeseries(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
    granularity: Literal["daily", "weekly", "monthly", "yearly"] = Query("daily"),
    start: str | None = Query(None, description="ISO başlangıç (opsiyonel)"),
    end: str | None = Query(None, description="ISO bitiş (opsiyonel)"),
    days: int | None = Query(None, ge=1, le=3660, description="Aralık gün sayısı (start/end yoksa)"),
):
    """Tamamlanan ödemelerden gelir ve biten oturumlardan sayı — dönem kovaları (UTC)."""
    lot = db.query(ParkingLot).filter(ParkingLot.is_active).first()
    if not lot:
        return {
            "granularity": granularity,
            "start": None,
            "end": None,
            "buckets": [],
        }

    end_dt = _parse_optional_datetime(end) or datetime.utcnow()
    start_dt = _parse_optional_datetime(start)
    if start_dt is None:
        span = days if days is not None else _default_range_days(granularity)
        start_dt = end_dt - timedelta(days=span)

    payments = (
        db.query(Payment)
        .join(ParkingSession, Payment.session_id == ParkingSession.id)
        .join(Spot, ParkingSession.spot_id == Spot.id)
        .filter(
            Spot.parking_lot_id == lot.id,
            Payment.status == PaymentStatus.completed,
            Payment.created_at >= start_dt,
            Payment.created_at <= end_dt,
        )
        .all()
    )
    ended_sessions = (
        db.query(ParkingSession)
        .join(Spot, ParkingSession.spot_id == Spot.id)
        .filter(
            Spot.parking_lot_id == lot.id,
            ParkingSession.status == SessionStatus.ended,
            ParkingSession.ended_at.isnot(None),
            ParkingSession.ended_at >= start_dt,
            ParkingSession.ended_at <= end_dt,
        )
        .all()
    )

    agg: dict[str, dict[str, float]] = defaultdict(lambda: {"revenue": 0.0, "sessions": 0.0})
    for p in payments:
        if not p.created_at:
            continue
        key = _bucket_label_utc(p.created_at, granularity)
        agg[key]["revenue"] += float(p.amount or Decimal("0"))
    for s in ended_sessions:
        if not s.ended_at:
            continue
        key = _bucket_label_utc(s.ended_at, granularity)
        agg[key]["sessions"] += 1.0

    def _sort_key(label: str) -> tuple:
        if granularity == "weekly" and "-W" in label:
            y, rest = label.split("-W", 1)
            return (int(y), int(rest))
        if granularity in ("daily", "monthly"):
            parts = [int(x) for x in label.replace("-", " ").split() if x.isdigit()]
            return tuple(parts) if parts else (label,)
        if granularity == "yearly":
            return (int(label),)
        return (label,)

    keys = sorted(agg.keys(), key=_sort_key)
    buckets = [
        {
            "label": k,
            "revenue": round(agg[k]["revenue"], 2),
            "sessions": int(agg[k]["sessions"]),
        }
        for k in keys
    ]
    return {
        "granularity": granularity,
        "start": start_dt.isoformat(),
        "end": end_dt.isoformat(),
        "buckets": buckets,
    }


# ── Park alanı (spot) CRUD ──────────────────────────────────────────


def _get_active_lot(db: Session) -> ParkingLot:
    lot = db.query(ParkingLot).filter(ParkingLot.is_active).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Aktif otopark bulunamadı")
    return lot


@router.get("/pricing", response_model=PricingResponse)
def get_admin_pricing(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
):
    """Aktif otoparkın ücretlendirme kaydı (panel + mobil aynı kaynak)."""
    lot = _get_active_lot(db)
    rules = get_lot_pricing_rules(db, lot.id)
    if not rules:
        raise HTTPException(status_code=404, detail="Ücretlendirme bulunamadı")
    return PricingResponse.model_validate(rules)


@router.put("/pricing", response_model=PricingResponse)
def update_admin_pricing(
    payload: PricingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
):
    """Ücretlendirme güncelle; mobil uygulama GET /pricing ile anında güncel veriyi alır."""
    lot = _get_active_lot(db)
    pricing = db.query(Pricing).filter(Pricing.parking_lot_id == lot.id).first()
    if not pricing:
        raise HTTPException(status_code=404, detail="Ücretlendirme bulunamadı")
    data = payload.model_dump(exclude_unset=True, mode="json")
    base = resolved_pricing_rules(pricing.pricing_rules)
    if "free_minutes" in data:
        base["free_minutes"] = int(data["free_minutes"])
    if "brackets" in data:
        rows = data["brackets"]
        new_brackets = []
        for i, row in enumerate(rows):
            if i < len(rows) - 1:
                new_brackets.append(
                    {"max_minutes": int(row["max_minutes"]), "price": str(row["price"])}
                )
            else:
                new_brackets.append({"price": str(row["price"])})
        base["brackets"] = new_brackets
    pricing.pricing_rules = base
    pricing.currency = "TRY"
    db.commit()
    db.refresh(pricing)
    return PricingResponse.model_validate(
        rules_for_api_response(pricing.pricing_rules, pricing.currency)
    )


@router.get("/spots", response_model=list[SpotResponse])
def list_admin_spots(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
):
    """Aktif otoparkın tüm park alanlarını döner (section/row bilgileriyle)."""
    lot = _get_active_lot(db)
    spots = (
        db.query(Spot)
        .filter(Spot.parking_lot_id == lot.id)
        .order_by(Spot.section, Spot.row_number, Spot.spot_number)
        .all()
    )
    return [SpotResponse.model_validate(s) for s in spots]


@router.post("/spots/bulk", response_model=list[SpotResponse])
def bulk_save_spots(
    payload: SpotBulkSave,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
):
    """Tüm park alanlarını toplu kaydet (mevcut spotlar silinip yenileri eklenir)."""
    lot = _get_active_lot(db)

    db.query(Spot).filter(Spot.parking_lot_id == lot.id).delete()
    db.flush()

    new_spots: list[Spot] = []
    for i, s in enumerate(payload.spots):
        spot = Spot(
            parking_lot_id=lot.id,
            spot_number=s.spot_number,
            bbox=s.bbox,
            section=s.section,
            row_number=s.row_number,
            mask_index=i + 1,
            is_occupied=False,
        )
        db.add(spot)
        new_spots.append(spot)

    db.commit()
    for sp in new_spots:
        db.refresh(sp)

    _signal_pipeline_reload()

    return [SpotResponse.model_validate(sp) for sp in new_spots]


@router.put("/spots/{spot_id}", response_model=SpotResponse)
def update_spot(
    spot_id: int = Path(...),
    payload: SpotUpdate = ...,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
):
    """Tek park alanını güncelle."""
    spot = db.query(Spot).filter(Spot.id == spot_id).first()
    if not spot:
        raise HTTPException(status_code=404, detail="Park alanı bulunamadı")
    if payload.spot_number is not None:
        spot.spot_number = payload.spot_number
    if payload.bbox is not None:
        spot.bbox = payload.bbox
    if payload.section is not None:
        spot.section = payload.section
    if payload.row_number is not None:
        spot.row_number = payload.row_number
    db.commit()
    db.refresh(spot)
    _signal_pipeline_reload()
    return SpotResponse.model_validate(spot)


@router.delete("/spots/{spot_id}")
def delete_spot(
    spot_id: int = Path(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
):
    """Tek park alanını sil."""
    spot = db.query(Spot).filter(Spot.id == spot_id).first()
    if not spot:
        raise HTTPException(status_code=404, detail="Park alanı bulunamadı")
    db.delete(spot)
    db.commit()
    _signal_pipeline_reload()
    return {"detail": "Silindi"}


@router.delete("/spots")
def delete_all_spots(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
):
    """Aktif otoparkın tüm park alanlarını sil."""
    lot = _get_active_lot(db)
    count = db.query(Spot).filter(Spot.parking_lot_id == lot.id).delete()
    db.commit()
    _signal_pipeline_reload()
    return {"detail": f"{count} park alanı silindi"}


@router.get("/reservations", response_model=list[ReservationResponse])
def list_reservations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
    status_filter: str | None = Query(None, alias="status"),
):
    """Tüm rezervasyonları listele."""
    from app.api.reservations import _expire_stale_reservations
    _expire_stale_reservations(db)

    q = db.query(Reservation)
    if status_filter:
        q = q.filter(Reservation.status == status_filter)
    reservations = q.order_by(Reservation.reserved_at.desc()).limit(200).all()
    result = []
    for r in reservations:
        resp = ReservationResponse.model_validate(r)
        resp.spot_number = r.spot.spot_number if r.spot else None
        result.append(resp)
    return result


def _signal_pipeline_reload():
    """Video stream pipeline'ına spotların değiştiğini bildir."""
    try:
        from app.api.video_stream import reload_spots
        reload_spots()
    except Exception:
        pass


# ─── Kullanıcı yönetimi ────────────────────────────────────────────────────


def _user_row(u: User) -> AdminUserRow:
    role_val = u.role.value if hasattr(u.role, "value") else str(u.role)
    return AdminUserRow(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        first_name=u.first_name,
        last_name=u.last_name,
        role=role_val,
        is_active=u.is_active,
        created_at=u.created_at.isoformat() if u.created_at else None,
        missed_reservation_entry_count=u.missed_reservation_entry_count or 0,
    )


@router.get("/users", response_model=list[AdminUserRow])
def list_users(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
    role_filter: str | None = Query(None, alias="role"),
    q: str | None = Query(None, description="E-posta veya ad ile arama"),
):
    """Tüm kullanıcıları listeler (admin yetkisi gerekir)."""
    qry = db.query(User)
    if role_filter:
        try:
            qry = qry.filter(User.role == UserRole(role_filter))
        except ValueError:
            raise HTTPException(status_code=400, detail="Geçersiz rol")
    if q:
        like = f"%{q.lower().strip()}%"
        qry = qry.filter(
            func.lower(User.email).like(like)
            | func.lower(User.full_name).like(like)
        )
    users = qry.order_by(User.created_at.desc()).limit(500).all()
    return [_user_row(u) for u in users]


@router.post("/users", response_model=AdminUserRow, status_code=201)
def create_user(
    data: AdminUserCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
):
    """Yeni kullanıcı oluşturur (admin/operator/customer)."""
    email = data.email.lower().strip()
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayıtlı")

    new_user = User(
        email=email,
        hashed_password=get_password_hash(data.password),
        full_name=(data.full_name or "").strip() or None,
        role=UserRole(data.role),
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return _user_row(new_user)


@router.put("/users/{user_id}", response_model=AdminUserRow)
def update_user(
    user_id: int,
    data: AdminUserUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
):
    """Rol, durum veya isim güncelle."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    if data.role is not None:
        # Son admin'i operator/customer'a düşürmeyi engelle
        if target.role == UserRole.admin and data.role != "admin":
            admin_count = db.query(User).filter(User.role == UserRole.admin).count()
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="Son yöneticinin rolü değiştirilemez")
        target.role = UserRole(data.role)
    if data.is_active is not None:
        if not data.is_active and target.role == UserRole.admin:
            admin_active = (
                db.query(User)
                .filter(User.role == UserRole.admin, User.is_active.is_(True))
                .count()
            )
            if admin_active <= 1:
                raise HTTPException(status_code=400, detail="Son aktif yönetici pasifleştirilemez")
        target.is_active = data.is_active
    if data.full_name is not None:
        target.full_name = (data.full_name or "").strip() or None
    db.commit()
    db.refresh(target)
    return _user_row(target)


@router.get("/users/{user_id}/detail")
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
):
    """
    KVKK uyumlu kullanıcı detayı: profil + otopark hareketleri + rezervasyonlar
    + ödemeler + kayıtlı araçlar + kayıtlı kartlar (son 4 hane + marka).
    Şifre veya tam kart numarası gibi hassas alanlar döndürülmez.
    """
    from app.models import UserVehicle, UserPaymentCard

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    role_val = target.role.value if hasattr(target.role, "value") else str(target.role)

    # Park oturumları (en yeniler önce)
    sessions = (
        db.query(ParkingSession)
        .options(joinedload(ParkingSession.spot), joinedload(ParkingSession.payment))
        .filter(ParkingSession.user_id == user_id)
        .order_by(ParkingSession.started_at.desc())
        .limit(100)
        .all()
    )

    session_list = []
    total_paid = 0.0
    for s in sessions:
        st = s.status.value if hasattr(s.status, "value") else s.status
        p = _payment_dict(s.payment)
        if p and p.get("status") == "completed":
            total_paid += float(p.get("amount") or 0)
        session_list.append({
            "id": s.id,
            "spot_number": s.spot.spot_number if s.spot else None,
            "section": s.spot.section if s.spot else None,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "duration_minutes": (
                int((s.ended_at - s.started_at).total_seconds() / 60)
                if s.ended_at and s.started_at else None
            ),
            "plate_number": s.plate_number,
            "total_fee": float(s.total_fee) if s.total_fee else None,
            "status": st,
            "payment": p,
        })

    # Rezervasyonlar
    reservations = (
        db.query(Reservation)
        .options(joinedload(Reservation.spot))
        .filter(Reservation.user_id == user_id)
        .order_by(Reservation.reserved_at.desc())
        .limit(50)
        .all()
    )
    reservation_list = []
    for r in reservations:
        rs = r.status.value if hasattr(r.status, "value") else r.status
        reservation_list.append({
            "id": r.id,
            "spot_number": r.spot.spot_number if r.spot else None,
            "reserved_at": r.reserved_at.isoformat() if r.reserved_at else None,
            "scheduled_start_at": r.scheduled_start_at.isoformat() if r.scheduled_start_at else None,
            "expires_at": r.expires_at.isoformat() if r.expires_at else None,
            "entry_deadline_at": r.entry_deadline_at.isoformat() if r.entry_deadline_at else None,
            "status": rs,
        })

    # Araçlar
    vehicles = db.query(UserVehicle).filter(UserVehicle.user_id == user_id).all()
    vehicle_list = [
        {
            "id": v.id,
            "plate": v.plate,
            "label": v.label,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in vehicles
    ]

    # Ödeme kartları (sadece son 4 hane + marka — KVKK uyumlu)
    cards = db.query(UserPaymentCard).filter(UserPaymentCard.user_id == user_id).all()
    card_list = [
        {
            "id": c.id,
            "last_four": c.last_four,
            "brand": c.brand,
            "holder_name": c.holder_name,
            "exp_month": c.exp_month,
            "exp_year": c.exp_year,
            "label": c.label,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in cards
    ]

    # Özet istatistikler
    summary = {
        "session_count": len(session_list),
        "active_session": any(s["status"] == "active" for s in session_list),
        "total_paid": round(total_paid, 2),
        "missed_reservation_count": target.missed_reservation_entry_count or 0,
        "vehicle_count": len(vehicle_list),
        "card_count": len(card_list),
    }

    return {
        "profile": {
            "id": target.id,
            "email": target.email,
            "full_name": target.full_name,
            "first_name": target.first_name,
            "last_name": target.last_name,
            "birth_date": target.birth_date.isoformat() if target.birth_date else None,
            "gender": target.gender,
            "role": role_val,
            "is_active": target.is_active,
            "created_at": target.created_at.isoformat() if target.created_at else None,
        },
        "summary": summary,
        "sessions": session_list,
        "reservations": reservation_list,
        "vehicles": vehicle_list,
        "payment_cards": card_list,
    }


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
):
    """Bir kullanıcıyı siler. Son admin silinemez. Kendinizi silemezsiniz."""
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="Kendi hesabınızı bu yoldan silemezsiniz")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    if target.role == UserRole.admin:
        admin_count = db.query(User).filter(User.role == UserRole.admin).count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Son yönetici silinemez")
    db.delete(target)
    db.commit()
    return None


# ─── Sistem sağlığı ────────────────────────────────────────────────────────


@router.get("/health")
def system_health(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
):
    """Backend, veritabanı ve YOLO worker durumu özeti."""
    import os
    import platform

    settings = get_settings()
    db_path_obj: FsPath | None = None
    db_size_bytes = 0
    try:
        db_path_obj = _db_path()
        if db_path_obj.exists():
            db_size_bytes = db_path_obj.stat().st_size
    except Exception:
        pass

    # YOLO video stream durumu
    yolo_status = "idle"
    yolo_device = "?"
    try:
        from app.api.video_stream import _initialized, _device  # type: ignore
        if _initialized:
            yolo_status = "ready"
            yolo_device = _device
    except Exception:
        pass

    # Otopark bilgisi
    lot = db.query(ParkingLot).filter(ParkingLot.is_active).first()
    spot_count = (
        db.query(Spot).filter(Spot.parking_lot_id == lot.id).count() if lot else 0
    )

    # Kullanıcı sayısı (rol başına)
    role_counts = {}
    for r in UserRole:
        role_counts[r.value] = db.query(User).filter(User.role == r).count()

    # Aktif oturum
    active_sessions = (
        db.query(ParkingSession).filter(ParkingSession.status == SessionStatus.active).count()
    )

    # Yedek dosyaları
    backups = []
    if db_path_obj is not None and db_path_obj.parent.exists():
        for f in db_path_obj.parent.glob(f"{db_path_obj.stem}_pre_restore_*{db_path_obj.suffix}"):
            try:
                stat = f.stat()
                backups.append({
                    "name": f.name,
                    "size_bytes": stat.st_size,
                    "modified_at": datetime.utcfromtimestamp(stat.st_mtime).isoformat(),
                })
            except Exception:
                continue
    backups.sort(key=lambda b: b["modified_at"], reverse=True)

    return {
        "backend": {
            "status": "ok",
            "python_version": platform.python_version(),
            "platform": platform.platform(),
        },
        "database": {
            "type": "sqlite" if settings.DATABASE_URL.startswith("sqlite") else "other",
            "path": str(db_path_obj) if db_path_obj else None,
            "size_bytes": db_size_bytes,
            "size_human": _human_bytes(db_size_bytes),
        },
        "cv": {
            "status": yolo_status,
            "device": yolo_device,
            "interval_sec": settings.CV_WORKER_INTERVAL_SEC,
            "model_path": settings.CV_MODEL_PATH,
        },
        "parking_lot": {
            "name": lot.name if lot else None,
            "spot_count": spot_count,
            "active_sessions": active_sessions,
        },
        "users": role_counts,
        "backups": backups[:10],
        "checked_at": datetime.utcnow().isoformat(),
    }


def _human_bytes(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


# ─── Veritabanı yedekleme / geri yükleme ─────────────────────────────────────
# Komisyon Madde 6 karşılığı. Sadece SQLite için anlamlıdır.


def _db_path() -> FsPath:
    """Mevcut SQLite DB'nin dosya yolunu döndürür."""
    settings = get_settings()
    url = settings.DATABASE_URL
    if not url.startswith("sqlite"):
        raise HTTPException(
            status_code=400,
            detail="Yedekleme yalnızca SQLite veritabanı için destekleniyor.",
        )
    # sqlite:///abs/path veya sqlite:///./relative
    prefix = "sqlite:///"
    raw = url[len(prefix):] if url.startswith(prefix) else url.split(":///", 1)[1]
    p = FsPath(raw).resolve()
    return p


@router.get("/backup")
def download_backup(
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_admin),
):
    """
    Mevcut veritabanının canlı bir yedeğini indirir.
    sqlite3 .backup API'si açık yazımlar sırasında bile tutarlı bir snapshot üretir.
    """
    src = _db_path()
    if not src.exists():
        raise HTTPException(status_code=404, detail="Veritabanı dosyası bulunamadı")

    # Tempdir'e canlı snapshot al — orijinal dosyaya dokunma.
    tmp_dir = FsPath(tempfile.mkdtemp(prefix="carparking_backup_"))
    out_name = f"carparking_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.db"
    out_path = tmp_dir / out_name

    try:
        src_conn = sqlite3.connect(str(src))
        dest_conn = sqlite3.connect(str(out_path))
        with dest_conn:
            src_conn.backup(dest_conn)
        dest_conn.close()
        src_conn.close()
    except Exception:
        _logger.exception("DB yedek alımı başarısız")
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="Yedek alınamadı")

    # Yanıt gönderildikten sonra geçici dizini temizle
    background_tasks.add_task(shutil.rmtree, str(tmp_dir), True)

    _logger.info("Backup oluşturuldu: %s (%d byte)", out_name, out_path.stat().st_size)
    return FileResponse(
        path=str(out_path),
        media_type="application/octet-stream",
        filename=out_name,
    )


def _is_valid_sqlite(path: FsPath) -> bool:
    """SQLite dosya imzasını (16 byte header) ve integrity_check'i doğrular."""
    try:
        with open(path, "rb") as f:
            header = f.read(16)
        if not header.startswith(b"SQLite format 3"):
            return False
        conn = sqlite3.connect(str(path))
        try:
            row = conn.execute("PRAGMA integrity_check").fetchone()
            return row is not None and row[0] == "ok"
        finally:
            conn.close()
    except Exception:
        return False


@router.post("/restore")
async def restore_backup(
    file: UploadFile = File(..., description="Daha önce indirilmiş .db dosyası"),
    user: User = Depends(get_current_admin),
):
    """
    Yüklenen dosyayı veritabanı olarak geri yükler.
    Mevcut DB önce zaman damgalı bir yedek olarak korunur.
    Geri yükleme sonrası backend yeniden başlatılmalıdır (bağlantı havuzu eskidir).
    """
    target = _db_path()
    if not target.parent.exists():
        raise HTTPException(status_code=500, detail="Hedef dizin bulunamadı")

    # Yüklenen içeriği geçici bir dosyaya yaz, doğrula
    tmp_dir = FsPath(tempfile.mkdtemp(prefix="carparking_restore_"))
    tmp_path = tmp_dir / "upload.db"
    try:
        with open(tmp_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)

        if not _is_valid_sqlite(tmp_path):
            raise HTTPException(
                status_code=400,
                detail="Yüklenen dosya geçerli bir SQLite veritabanı değil.",
            )

        # Mevcut bağlantıları kapat
        try:
            SessionLocal.close_all()
        except Exception:
            pass
        try:
            engine.dispose()
        except Exception:
            pass

        # Mevcut DB'yi zaman damgalı yedek olarak yeniden adlandır
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        if target.exists():
            backup_name = target.with_name(f"{target.stem}_pre_restore_{ts}{target.suffix}")
            shutil.move(str(target), str(backup_name))
            _logger.info("Mevcut DB yedek olarak taşındı: %s", backup_name.name)

        shutil.move(str(tmp_path), str(target))
        _logger.warning("Veritabanı geri yüklendi: %s", target.name)

        return {
            "ok": True,
            "detail": "Veritabanı geri yüklendi. Backend yeniden başlatılmalı.",
            "restart_required": True,
        }
    except HTTPException:
        raise
    except Exception:
        _logger.exception("DB geri yükleme başarısız")
        raise HTTPException(status_code=500, detail="Geri yükleme başarısız")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


