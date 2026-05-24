"""Spots ve Parking API."""
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.api.reservations import _expire_stale_reservations
from app.core.config import get_settings
from app.core.database import get_db
from app.models import Spot, ParkingSession, ParkingLot, Reservation, ParkingIntent, Pricing
from app.models.parking_session import SessionStatus
from app.models.reservation import ReservationStatus
from app.models.parking_intent import ParkingIntentKind
from app.schemas.spot import (
    SpotResponse,
    SpotsSummary,
    ParkingSessionStart,
    ParkingSessionResponse,
    CreateParkingIntentRequest,
)
from app.schemas.pricing import PricingResponse
from app.services.parking_fee import compute_parking_fee, get_lot_pricing_rules
from app.services.spots_summary import compute_spot_counts
from app.services.payment import record_completed_payment
from app.api.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/spots", tags=["spots"])
parking_router = APIRouter(prefix="/parking", tags=["parking"])
pricing_router = APIRouter(prefix="/pricing", tags=["pricing"])


# --- Spots ---
@router.get("", response_model=SpotsSummary)
def list_spots(
    lot_id: int | None = Query(None, description="Otopark ID (yoksa ilk otopark)"),
    db: Session = Depends(get_db),
):
    """Tüm park yerlerinin durumunu döner (giriş zorunlu değil)."""
    if lot_id is None:
        lot = db.query(ParkingLot).filter(ParkingLot.is_active).first()
        if not lot:
            return SpotsSummary(
                total=0,
                available=0,
                occupied=0,
                reserved=0,
                spots=[],
                parking_lot_name=None,
            )
        lot_id = lot.id
    lot_row = db.query(ParkingLot).filter(ParkingLot.id == lot_id).first()
    spots = db.query(Spot).filter(Spot.parking_lot_id == lot_id).order_by(Spot.spot_number).all()
    counts = compute_spot_counts(spots)
    return SpotsSummary(
        **counts,
        spots=[SpotResponse.model_validate(s) for s in spots],
        parking_lot_name=lot_row.name if lot_row else None,
    )


# --- Parking Sessions ---
def _start_parking_for_spot(
    db: Session,
    user: User,
    spot_id: int,
    plate_number: str | None,
) -> ParkingSessionResponse:
    """Ortak park başlatma mantığı. Hem klasik hem QR akışı kullanır."""
    _expire_stale_reservations(db)
    spot = db.query(Spot).filter(Spot.id == spot_id).first()
    if not spot:
        raise HTTPException(status_code=404, detail="Park yeri bulunamadı")
    if spot.is_occupied:
        raise HTTPException(status_code=400, detail="Bu park yeri dolu")

    if spot.is_reserved:
        own_reservation = (
            db.query(Reservation)
            .filter(
                Reservation.spot_id == spot.id,
                Reservation.user_id == user.id,
                Reservation.status == ReservationStatus.active,
            )
            .first()
        )
        if not own_reservation:
            raise HTTPException(status_code=400, detail="Bu park yeri başka bir kullanıcı tarafından rezerve edilmiş")
        deadline = own_reservation.entry_deadline_at or own_reservation.expires_at
        if deadline and datetime.utcnow() > deadline:
            raise HTTPException(
                status_code=400,
                detail="Rezervasyon giriş süresi doldu; giriş QR’ı zamanında okutulmadı.",
            )
        own_reservation.status = ReservationStatus.used
        spot.is_reserved = False

    active = db.query(ParkingSession).filter(
        ParkingSession.user_id == user.id,
        ParkingSession.status == SessionStatus.active,
    ).first()
    if active:
        raise HTTPException(status_code=400, detail="Zaten aktif bir park oturumunuz var")

    session = ParkingSession(
        user_id=user.id,
        spot_id=spot_id,
        plate_number=plate_number,
        status=SessionStatus.active,
    )
    spot.is_occupied = True
    db.add(session)
    db.commit()
    db.refresh(session)
    resp = ParkingSessionResponse.model_validate(session)
    resp.spot_number = spot.spot_number
    return resp


@parking_router.post("/start", response_model=ParkingSessionResponse)
def start_parking(
    data: ParkingSessionStart,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Park oturumu başlat (QR'sız - admin/test için)."""
    return _start_parking_for_spot(db, user, data.spot_id, data.plate_number)


# ── Kullanıcıya özel giriş QR (intent) akışı ──
import secrets
from datetime import datetime
from app.models.parking_intent import ParkingIntent, PARKING_INTENT_TTL_MINUTES


def _public_base_url(request: Request) -> str:
    settings = get_settings()
    if settings.PUBLIC_BASE_URL:
        return settings.PUBLIC_BASE_URL.rstrip("/")
    # Request'ten türet (Host header'ından)
    return f"{request.url.scheme}://{request.headers.get('host', request.url.netloc)}"


def _resolve_intent_target(
    db: Session,
    user: User,
    data: CreateParkingIntentRequest,
) -> tuple[ParkingIntentKind, Spot, str | None]:
    """Intent için hedef spot + plate'i kind'a göre hazırla."""
    kind = ParkingIntentKind(data.kind)

    if kind == ParkingIntentKind.entry:
        _expire_stale_reservations(db)
        if data.spot_id is None:
            raise HTTPException(status_code=400, detail="spot_id gerekli")
        spot = db.query(Spot).filter(Spot.id == data.spot_id).first()
        if not spot:
            raise HTTPException(status_code=404, detail="Park yeri bulunamadı")
        if spot.is_occupied:
            raise HTTPException(status_code=400, detail="Bu park yeri dolu")
        if spot.is_reserved:
            own = (
                db.query(Reservation)
                .filter(
                    Reservation.spot_id == spot.id,
                    Reservation.user_id == user.id,
                    Reservation.status == ReservationStatus.active,
                )
                .first()
            )
            if not own:
                raise HTTPException(status_code=400, detail="Bu park yeri başka bir kullanıcı tarafından rezerve edilmiş")
        active = (
            db.query(ParkingSession)
            .filter(ParkingSession.user_id == user.id, ParkingSession.status == SessionStatus.active)
            .first()
        )
        if active:
            raise HTTPException(status_code=400, detail="Zaten aktif bir park oturumunuz var")
        return kind, spot, data.plate_number

    # exit
    active = (
        db.query(ParkingSession)
        .filter(ParkingSession.user_id == user.id, ParkingSession.status == SessionStatus.active)
        .first()
    )
    if not active:
        raise HTTPException(status_code=400, detail="Aktif park oturumunuz yok")
    spot = db.query(Spot).filter(Spot.id == active.spot_id).first()
    if not spot:
        raise HTTPException(status_code=404, detail="Aktif oturumun park yeri bulunamadı")
    return kind, spot, active.plate_number


@parking_router.post("/intent")
def create_parking_intent(
    data: CreateParkingIntentRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Giriş (entry) veya çıkış (exit) için kullanıcıya özel kısa ömürlü QR token'ı üretir.

    QR'da redeem URL bulunur; otopark giriş/çıkışındaki kamera URL'i açar, backend kind'a
    göre oturum başlatır veya bitirir.
    """
    kind, spot, plate_number = _resolve_intent_target(db, user, data)

    # Kullanıcının aynı kind için açık intent'lerini iptal et
    db.query(ParkingIntent).filter(
        ParkingIntent.user_id == user.id,
        ParkingIntent.kind == kind,
        ParkingIntent.consumed_at.is_(None),
        ParkingIntent.expires_at > datetime.utcnow(),
    ).update({ParkingIntent.consumed_at: datetime.utcnow()}, synchronize_session=False)

    intent = ParkingIntent(
        token=secrets.token_urlsafe(24),
        kind=kind,
        user_id=user.id,
        spot_id=spot.id,
        plate_number=plate_number,
    )
    db.add(intent)
    db.commit()
    db.refresh(intent)

    return {
        "token": intent.token,
        "kind": intent.kind.value,
        "spot_id": intent.spot_id,
        "spot_number": spot.spot_number,
        "expires_at": intent.expires_at.isoformat(),
        "ttl_minutes": PARKING_INTENT_TTL_MINUTES,
        "redeem_url": f"{_public_base_url(request)}/api/v1/parking/redeem/{intent.token}",
    }


@parking_router.get("/intent/active")
def get_active_parking_intent(
    request: Request,
    kind: str = Query("entry", pattern="^(entry|exit)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kullanıcının belirli kind için açık intent'ini döner."""
    kind_enum = ParkingIntentKind(kind)
    intent = (
        db.query(ParkingIntent)
        .filter(
            ParkingIntent.user_id == user.id,
            ParkingIntent.kind == kind_enum,
            ParkingIntent.consumed_at.is_(None),
            ParkingIntent.expires_at > datetime.utcnow(),
        )
        .order_by(ParkingIntent.id.desc())
        .first()
    )
    if not intent:
        return None
    spot = db.query(Spot).filter(Spot.id == intent.spot_id).first()
    return {
        "token": intent.token,
        "kind": intent.kind.value,
        "spot_id": intent.spot_id,
        "spot_number": spot.spot_number if spot else None,
        "expires_at": intent.expires_at.isoformat(),
        "ttl_minutes": PARKING_INTENT_TTL_MINUTES,
        "redeem_url": f"{_public_base_url(request)}/api/v1/parking/redeem/{intent.token}",
    }


def _render_redeem_page(title: str, message: str, ok: bool, details: dict | None = None) -> str:
    color = "#16a34a" if ok else "#dc2626"
    icon = "✅" if ok else "⚠️"
    detail_html = ""
    if details:
        rows = "".join(
            f"<div style='display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;'><span style='color:#64748b;'>{k}</span><span style='color:#0f172a;font-weight:600;'>{v}</span></div>"
            for k, v in details.items()
        )
        detail_html = f"<div style='margin-top:18px;text-align:left;'>{rows}</div>"
    return f"""<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CarParking — {title}</title></head>
<body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
  <div style="max-width:420px;width:100%;background:#fff;border-radius:16px;padding:28px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.08);">
    <div style="font-size:48px;line-height:1;">{icon}</div>
    <h1 style="margin:12px 0 4px;color:{color};font-size:22px;">{title}</h1>
    <p style="margin:0;color:#475569;font-size:15px;line-height:1.5;">{message}</p>
    {detail_html}
    <p style="margin-top:20px;color:#94a3b8;font-size:12px;">CarParking</p>
  </div>
</body></html>"""


@parking_router.get("/redeem/{token}", response_class=HTMLResponse)
def redeem_parking_intent(
    token: str,
    db: Session = Depends(get_db),
):
    """Otopark girişindeki kameranın açacağı URL — token'ı tüketir ve oturumu başlatır.

    Auth gerekmez; token'ın kendisi yetkilendirme görür (kısa ömürlü, tek kullanımlık).
    """
    intent = db.query(ParkingIntent).filter(ParkingIntent.token == token).first()
    if not intent:
        return HTMLResponse(_render_redeem_page(
            "Geçersiz QR", "Bu QR sistemde bulunamadı.", ok=False
        ), status_code=404)

    if intent.consumed_at is not None:
        return HTMLResponse(_render_redeem_page(
            "Kullanılmış QR", "Bu QR daha önce kullanılmış. Lütfen yeni bir QR oluşturun.", ok=False
        ), status_code=400)

    if intent.expires_at < datetime.utcnow():
        return HTMLResponse(_render_redeem_page(
            "Süresi Doldu", "QR kodun geçerlilik süresi doldu. Lütfen mobil uygulamadan yeni bir QR oluşturun.", ok=False
        ), status_code=400)

    user = db.query(User).filter(User.id == intent.user_id).first()
    if not user or not user.is_active:
        return HTMLResponse(_render_redeem_page(
            "Hesap hatası", "Bu QR'a ait kullanıcı hesabı bulunamadı veya devre dışı.", ok=False
        ), status_code=400)

    display_name = (user.full_name or f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email)

    if intent.kind == ParkingIntentKind.entry:
        try:
            resp = _start_parking_for_spot(db, user, intent.spot_id, intent.plate_number)
        except HTTPException as e:
            return HTMLResponse(_render_redeem_page(
                "Giriş yapılamadı", e.detail, ok=False
            ), status_code=e.status_code)

        intent.consumed_at = datetime.utcnow()
        db.commit()
        return HTMLResponse(_render_redeem_page(
            "Giriş Başarılı",
            "Park oturumunuz başlatıldı. Aracınızı belirlenen alana park edebilirsiniz.",
            ok=True,
            details={
                "Müşteri": display_name,
                "Alan": resp.spot_number or f"#{resp.spot_id}",
                "Plaka": intent.plate_number or "—",
            },
        ))

    # exit
    try:
        resp = _end_parking_for_user(db, user)
    except HTTPException as e:
        return HTMLResponse(_render_redeem_page(
            "Çıkış yapılamadı", e.detail, ok=False
        ), status_code=e.status_code)

    intent.consumed_at = datetime.utcnow()
    db.commit()

    fee_val = float(resp.total_fee) if resp.total_fee is not None else 0.0
    fee_str = f"{fee_val:.2f} TRY" if fee_val > 0 else "Ücretsiz"
    return HTMLResponse(_render_redeem_page(
        "Çıkış Başarılı",
        "Park oturumunuz sonlandırıldı, ödemeniz tamamlandı. İyi yolculuklar.",
        ok=True,
        details={
            "Müşteri": display_name,
            "Alan": resp.spot_number or f"#{resp.spot_id}",
            "Ücret": fee_str,
        },
    ))


def _end_parking_for_user(db: Session, user: User) -> ParkingSessionResponse:
    """Ortak çıkış (park bitirme) mantığı. Hem /parking/end hem de exit-QR redeem kullanır."""
    session = db.query(ParkingSession).filter(
        ParkingSession.user_id == user.id,
        ParkingSession.status == SessionStatus.active,
    ).first()
    if not session:
        raise HTTPException(status_code=400, detail="Aktif park oturumu yok")

    session.ended_at = datetime.utcnow()
    session.status = SessionStatus.ended
    duration_min = (session.ended_at - session.started_at).total_seconds() / 60
    pricing = db.query(Pricing).filter(Pricing.parking_lot_id == session.spot.parking_lot_id).first()
    if pricing:
        session.total_fee = compute_parking_fee(duration_min, pricing.pricing_rules)
    else:
        session.total_fee = Decimal("0")

    session.spot.is_occupied = False
    record_completed_payment(db, session, user.id)
    db.commit()
    db.refresh(session)
    resp = ParkingSessionResponse.model_validate(session)
    resp.spot_number = session.spot.spot_number
    return resp


@parking_router.post("/end", response_model=ParkingSessionResponse)
def end_parking(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Park oturumunu bitir (ücret hesaplanır) - QR'sız (test/yedek)."""
    return _end_parking_for_user(db, user)


@parking_router.get("/my", response_model=list[ParkingSessionResponse])
def my_sessions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kullanıcının park oturumları."""
    sessions = db.query(ParkingSession).filter(
        ParkingSession.user_id == user.id
    ).order_by(ParkingSession.started_at.desc()).limit(50).all()
    return [
        ParkingSessionResponse(
            id=s.id,
            user_id=s.user_id,
            spot_id=s.spot_id,
            started_at=s.started_at,
            ended_at=s.ended_at,
            total_fee=s.total_fee,
            status=s.status.value if hasattr(s.status, "value") else s.status,
            spot_number=s.spot.spot_number,
        )
        for s in sessions
    ]


@parking_router.get("/active", response_model=ParkingSessionResponse | None)
def active_session(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Aktif park oturumu varsa döner."""
    session = db.query(ParkingSession).filter(
        ParkingSession.user_id == user.id,
        ParkingSession.status == SessionStatus.active,
    ).first()
    if not session:
        return None
    return ParkingSessionResponse(
        id=session.id,
        user_id=session.user_id,
        spot_id=session.spot_id,
        started_at=session.started_at,
        ended_at=session.ended_at,
        total_fee=session.total_fee,
        status=session.status.value if hasattr(session.status, "value") else session.status,
        spot_number=session.spot.spot_number if session.spot else None,
    )


# --- Pricing ---
@pricing_router.get("", response_model=PricingResponse)
def get_pricing(
    lot_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    """Ücretlendirme bilgisi."""
    if lot_id is None:
        lot = db.query(ParkingLot).filter(ParkingLot.is_active).first()
        if not lot:
            raise HTTPException(status_code=404, detail="Otopark bulunamadı")
        lot_id = lot.id
    rules = get_lot_pricing_rules(db, lot_id)
    if not rules:
        raise HTTPException(status_code=404, detail="Ücretlendirme bulunamadı")
    return PricingResponse.model_validate(rules)
