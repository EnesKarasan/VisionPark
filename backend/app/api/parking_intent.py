"""
ParkingIntent API — QR ile giriş/çıkış akışı.

Akış:
  1. Mobil app `POST /parking/intent` ile entry veya exit niyeti oluşturur.
  2. Backend kısa ömürlü token + redeem_url üretir, mobilde QR olarak gösterilir.
  3. Kullanıcı iPhone kamerası ile QR'ı tarar → URL açılır → bu modüldeki
     `GET /parking/intent/redeem/{token}` çağrılır → intent consume edilir,
     entry ise ParkingSession başlar, exit ise mevcut oturum biter ve ödeme alınır.
  4. Mobil app aktif oturumu polling ile algılayıp ekranı kapatır.
"""
import secrets
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.reservations import _expire_stale_reservations
from app.core.config import get_settings
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.models import (
    ParkingIntent,
    ParkingLot,
    ParkingSession,
    Pricing,
    Reservation,
    Spot,
    User,
)
from app.models.parking_intent import PARKING_INTENT_TTL_MINUTES, ParkingIntentKind
from app.models.parking_session import SessionStatus
from app.models.reservation import ReservationStatus
from app.schemas.parking_intent import ParkingIntentCreate, ParkingIntentResponse
from app.services.parking_fee import compute_parking_fee
from app.services.payment import record_completed_payment

logger = get_logger("api.parking_intent")
settings = get_settings()

router = APIRouter(prefix="/parking/intent", tags=["parking-intent"])


# ── Yardımcılar ──────────────────────────────────────────────────────────────

def _public_base_url(request: Request) -> str:
    """redeem_url üretmek için kullanılan dış erişim adresi."""
    if settings.PUBLIC_BASE_URL:
        return settings.PUBLIC_BASE_URL.rstrip("/")
    # request.base_url genelde 'http://host:port/' döner
    return str(request.base_url).rstrip("/")


def _build_redeem_url(request: Request, token: str) -> str:
    return f"{_public_base_url(request)}/api/v1/parking/intent/redeem/{token}"


def _intent_response(intent: ParkingIntent, request: Request) -> ParkingIntentResponse:
    return ParkingIntentResponse(
        token=intent.token,
        kind=intent.kind.value if hasattr(intent.kind, "value") else intent.kind,
        spot_id=intent.spot_id,
        spot_number=intent.spot.spot_number if intent.spot else None,
        expires_at=intent.expires_at,
        ttl_minutes=PARKING_INTENT_TTL_MINUTES,
        redeem_url=_build_redeem_url(request, intent.token),
    )


def _find_active_intent(
    db: Session, user_id: int, kind: ParkingIntentKind
) -> ParkingIntent | None:
    now = datetime.utcnow()
    return (
        db.query(ParkingIntent)
        .filter(
            ParkingIntent.user_id == user_id,
            ParkingIntent.kind == kind,
            ParkingIntent.consumed_at.is_(None),
            ParkingIntent.expires_at > now,
        )
        .order_by(ParkingIntent.id.desc())
        .first()
    )


def _invalidate_open_intents(db: Session, user_id: int, kind: ParkingIntentKind) -> None:
    """Aynı tipte açık intent'leri (henüz consume edilmemiş) iptal eder."""
    now = datetime.utcnow()
    db.query(ParkingIntent).filter(
        ParkingIntent.user_id == user_id,
        ParkingIntent.kind == kind,
        ParkingIntent.consumed_at.is_(None),
        ParkingIntent.expires_at > now,
    ).update({ParkingIntent.expires_at: now}, synchronize_session=False)


# ── Endpoint'ler ─────────────────────────────────────────────────────────────


@router.post("", response_model=ParkingIntentResponse)
def create_intent(
    data: ParkingIntentCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Entry veya exit niyeti oluştur, redeem URL'i içeren QR verisini döndür."""
    kind_enum = ParkingIntentKind(data.kind)

    if kind_enum == ParkingIntentKind.entry:
        if data.spot_id is None:
            raise HTTPException(status_code=400, detail="Park alanı seçilmedi")

        _expire_stale_reservations(db)

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
                raise HTTPException(
                    status_code=400,
                    detail="Bu park yeri başka bir kullanıcı tarafından rezerve edilmiş",
                )

        active = (
            db.query(ParkingSession)
            .filter(
                ParkingSession.user_id == user.id,
                ParkingSession.status == SessionStatus.active,
            )
            .first()
        )
        if active:
            raise HTTPException(status_code=400, detail="Zaten aktif bir park oturumunuz var")

        # Aynı spot için açık intent varsa onu kullan (idempotent davranış)
        existing = _find_active_intent(db, user.id, ParkingIntentKind.entry)
        if existing and existing.spot_id == data.spot_id:
            return _intent_response(existing, request)

        # Farklı spot için açık entry intent'leri iptal et
        _invalidate_open_intents(db, user.id, ParkingIntentKind.entry)
        target_spot_id = data.spot_id
        plate = (data.plate_number or "").strip() or None

    else:  # exit
        session = (
            db.query(ParkingSession)
            .filter(
                ParkingSession.user_id == user.id,
                ParkingSession.status == SessionStatus.active,
            )
            .first()
        )
        if not session:
            raise HTTPException(status_code=400, detail="Aktif park oturumu yok")

        existing = _find_active_intent(db, user.id, ParkingIntentKind.exit)
        if existing and existing.spot_id == session.spot_id:
            return _intent_response(existing, request)

        _invalidate_open_intents(db, user.id, ParkingIntentKind.exit)
        target_spot_id = session.spot_id
        plate = session.plate_number

    intent = ParkingIntent(
        token=secrets.token_urlsafe(24),
        kind=kind_enum,
        user_id=user.id,
        spot_id=target_spot_id,
        plate_number=plate,
        expires_at=datetime.utcnow() + timedelta(minutes=PARKING_INTENT_TTL_MINUTES),
    )
    db.add(intent)
    db.commit()
    db.refresh(intent)
    logger.info(
        "ParkingIntent oluşturuldu: user=%s kind=%s spot=%s",
        user.id, intent.kind, intent.spot_id,
    )
    return _intent_response(intent, request)


@router.get("/active", response_model=ParkingIntentResponse | None)
def active_intent(
    request: Request,
    kind: str = Query("entry"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kullanıcının açık entry veya exit intent'i (varsa)."""
    try:
        kind_enum = ParkingIntentKind(kind)
    except ValueError:
        raise HTTPException(status_code=400, detail="Geçersiz kind")
    intent = _find_active_intent(db, user.id, kind_enum)
    if not intent:
        return None
    return _intent_response(intent, request)


# ── Redeem (public — QR taranınca açılır) ───────────────────────────────────


def _html_response(title: str, message: str, ok: bool = True, status_code: int = 200) -> HTMLResponse:
    color = "#16a34a" if ok else "#dc2626"
    bg_grad = (
        "linear-gradient(135deg, #0a1f33 0%, #153a5c 50%, #1e4a76 100%)"
        if ok
        else "linear-gradient(135deg, #1f1015 0%, #5c1518 50%, #76202a 100%)"
    )
    icon_svg = (
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" '
        'stroke-linecap="round" stroke-linejoin="round" style="width:36px;height:36px"><path d="m4.5 12.75 6 6 9-13.5"/></svg>'
        if ok
        else '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" '
        'stroke-linecap="round" stroke-linejoin="round" style="width:36px;height:36px"><path d="M6 18 18 6M6 6l12 12"/></svg>'
    )
    html = f"""<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · VisionPark</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         background: {bg_grad}; min-height: 100vh; display: flex; align-items: center;
         justify-content: center; padding: 20px; color: #fff; }}
  .brand {{ position: absolute; top: 24px; left: 50%; transform: translateX(-50%);
            font-size: 18px; font-weight: 800; letter-spacing: 1.5px; opacity: 0.85;
            text-shadow: 0 2px 6px rgba(0,0,0,0.25); }}
  .brand span {{ color: #60a5fa; }}
  .card {{ background: rgba(255,255,255,0.97); border-radius: 24px; padding: 40px 28px;
           max-width: 420px; width: 100%; text-align: center;
           box-shadow: 0 20px 60px rgba(0,0,0,0.3); }}
  .icon {{ width: 84px; height: 84px; border-radius: 50%; background: {color}; color: #fff;
          display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;
          box-shadow: 0 8px 20px {color}40; }}
  h1 {{ margin: 0 0 12px; font-size: 24px; color: #111827; font-weight: 700; }}
  p {{ margin: 0; color: #4b5563; line-height: 1.55; font-size: 16px; }}
  .divider {{ height: 1px; background: linear-gradient(to right, transparent, #e5e7eb, transparent);
              margin: 24px 0 16px; }}
  .small {{ font-size: 13px; color: #9ca3af; line-height: 1.5; }}
  .footer {{ position: absolute; bottom: 24px; left: 0; right: 0; text-align: center;
             font-size: 12px; opacity: 0.65; letter-spacing: 0.5px; }}
</style>
</head>
<body>
  <div class="brand">Vision<span>Park</span></div>
  <div class="card">
    <div class="icon">{icon_svg}</div>
    <h1>{title}</h1>
    <p>{message}</p>
    <div class="divider"></div>
    <p class="small">Bu pencereyi kapatabilirsiniz. Park sayfasındaki uygulama otomatik güncellenecektir.</p>
  </div>
  <div class="footer">© VisionPark · Akıllı Otopark Yönetimi</div>
</body>
</html>"""
    return HTMLResponse(content=html, status_code=status_code)


@router.get("/redeem/{token}", response_class=HTMLResponse)
def redeem_intent(token: str, db: Session = Depends(get_db)):
    """
    QR taranınca açılan public endpoint. Token consume edilir, entry/exit aksiyonu uygulanır.
    Mobil app polling ile aktif oturum değişimini algılayıp kullanıcıya bilgi verir.
    """
    intent = db.query(ParkingIntent).filter(ParkingIntent.token == token).first()
    if not intent:
        return _html_response(
            "QR Geçersiz", "Bu QR kodu sistemde bulunamadı.", ok=False, status_code=404
        )
    if intent.consumed_at is not None:
        return _html_response(
            "Zaten Kullanılmış", "Bu QR kodu daha önce taranmış.", ok=False, status_code=410
        )
    if intent.expires_at <= datetime.utcnow():
        return _html_response(
            "Süresi Dolmuş",
            "Bu QR kodunun süresi geçmiş. Lütfen mobil uygulamadan yenileyin.",
            ok=False,
            status_code=410,
        )

    kind = intent.kind if isinstance(intent.kind, ParkingIntentKind) else ParkingIntentKind(intent.kind)

    if kind == ParkingIntentKind.entry:
        return _redeem_entry(db, intent)
    return _redeem_exit(db, intent)


def _redeem_entry(db: Session, intent: ParkingIntent) -> HTMLResponse:
    _expire_stale_reservations(db)

    spot = db.query(Spot).filter(Spot.id == intent.spot_id).first()
    if not spot:
        return _html_response("Park Yeri Yok", "Seçilen alan bulunamadı.", ok=False, status_code=404)
    if spot.is_occupied:
        return _html_response("Alan Dolu", "Bu park yeri artık dolu.", ok=False, status_code=400)

    if spot.is_reserved:
        own = (
            db.query(Reservation)
            .filter(
                Reservation.spot_id == spot.id,
                Reservation.user_id == intent.user_id,
                Reservation.status == ReservationStatus.active,
            )
            .first()
        )
        if not own:
            return _html_response(
                "Rezerveli Alan",
                "Bu alan başka bir kullanıcıya rezerve.",
                ok=False,
                status_code=400,
            )
        deadline = own.entry_deadline_at or own.expires_at
        if deadline and datetime.utcnow() > deadline:
            return _html_response(
                "Rezervasyon Süresi Doldu",
                "Rezervasyon giriş süreniz geçmiş.",
                ok=False,
                status_code=400,
            )
        own.status = ReservationStatus.used
        spot.is_reserved = False

    active = (
        db.query(ParkingSession)
        .filter(
            ParkingSession.user_id == intent.user_id,
            ParkingSession.status == SessionStatus.active,
        )
        .first()
    )
    if active:
        return _html_response(
            "Aktif Oturum Var",
            "Zaten aktif park oturumunuz var.",
            ok=False,
            status_code=400,
        )

    session = ParkingSession(
        user_id=intent.user_id,
        spot_id=intent.spot_id,
        plate_number=intent.plate_number,
        status=SessionStatus.active,
    )
    spot.is_occupied = True
    intent.consumed_at = datetime.utcnow()
    db.add(session)
    db.commit()

    logger.info(
        "Entry redeem: user=%s spot=%s session başlatıldı",
        intent.user_id, intent.spot_id,
    )
    return _html_response(
        "Giriş Onaylandı",
        f"Park alanı {spot.spot_number} için oturumunuz başladı. İyi park dileriz.",
    )


def _redeem_exit(db: Session, intent: ParkingIntent) -> HTMLResponse:
    session = (
        db.query(ParkingSession)
        .filter(
            ParkingSession.user_id == intent.user_id,
            ParkingSession.status == SessionStatus.active,
        )
        .first()
    )
    if not session:
        return _html_response(
            "Aktif Oturum Yok",
            "Çıkış için aktif bir park oturumunuz bulunamadı.",
            ok=False,
            status_code=400,
        )

    session.ended_at = datetime.utcnow()
    session.status = SessionStatus.ended
    duration_min = (session.ended_at - session.started_at).total_seconds() / 60

    pricing = (
        db.query(Pricing)
        .filter(Pricing.parking_lot_id == session.spot.parking_lot_id)
        .first()
    )
    if pricing:
        session.total_fee = compute_parking_fee(duration_min, pricing.pricing_rules)
    else:
        session.total_fee = Decimal("0")

    session.spot.is_occupied = False
    record_completed_payment(db, session, intent.user_id)
    intent.consumed_at = datetime.utcnow()
    db.commit()

    fee_str = f"{float(session.total_fee or 0):.2f} TRY"
    logger.info(
        "Exit redeem: user=%s session=%s fee=%s",
        intent.user_id, session.id, fee_str,
    )
    return _html_response(
        "Çıkış Onaylandı",
        f"Park ücretiniz {fee_str} olarak tahsil edildi. Güvenli sürüşler!",
    )
