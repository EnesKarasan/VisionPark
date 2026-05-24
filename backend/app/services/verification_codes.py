"""E-posta doğrulama kodu isteği ve doğrulama (kayıt / şifre sıfırlama)."""
from datetime import datetime, timedelta
from typing import Callable, Type

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services.email_verification import notify_verification_code
from app.services.signup_code import codes_equal, generate_signup_code, hash_signup_code

MAX_VERIFY_ATTEMPTS = 5


def request_verification_code(
    db: Session,
    email: str,
    model: Type,
    *,
    user_must_exist: bool,
) -> str | None:
    """Doğrulama kodu üretir. debug_code yalnızca geliştirme modunda döner."""
    from sqlalchemy import func

    from app.models import User

    settings = get_settings()

    if user_must_exist:
        if not db.query(User.id).filter(func.lower(User.email) == email).first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bu e-posta ile kayıtlı hesap bulunamadı",
            )
    elif db.query(User.id).filter(func.lower(User.email) == email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu e-posta adresi zaten kayıtlı",
        )

    db.query(model).filter(
        model.email == email,
        model.consumed_at.is_(None),
    ).delete(synchronize_session=False)

    code = generate_signup_code()
    code_hash = hash_signup_code(settings.SECRET_KEY, email, code)
    expires = datetime.utcnow() + timedelta(minutes=settings.SIGNUP_CODE_EXPIRE_MINUTES)

    row = model(
        email=email,
        code_hash=code_hash,
        expires_at=expires,
        attempt_count=0,
    )
    db.add(row)
    db.commit()

    purpose = "password_reset" if user_must_exist else "signup"
    notify_verification_code(email, code, purpose)

    return code if settings.DEBUG_RETURN_SIGNUP_CODE else None


def verify_verification_code(
    db: Session,
    email: str,
    code: str,
    model: Type,
    issue_token: Callable[[str], str],
) -> str:
    """Kodu doğrular; başarılıysa kısa ömürlü JWT döner."""
    settings = get_settings()
    normalized = code.strip().replace(" ", "")

    if len(normalized) != 6 or not normalized.isdigit():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz kod formatı")

    row = (
        db.query(model)
        .filter(model.email == email, model.consumed_at.is_(None))
        .order_by(model.id.desc())
        .first()
    )

    if not row or row.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kod bulunamadı veya süresi doldu. Yeni kod isteyin.",
        )

    if row.attempt_count >= MAX_VERIFY_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Çok fazla hatalı deneme. Yeni kod isteyin.",
        )

    if not codes_equal(row.code_hash, settings.SECRET_KEY, email, normalized):
        row.attempt_count += 1
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Kod hatalı")

    row.consumed_at = datetime.utcnow()
    db.commit()
    return issue_token(email)
