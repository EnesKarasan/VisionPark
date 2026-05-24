"""Güvenlik - şifre hash, JWT."""
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8") if isinstance(hashed, str) else hashed)


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def validate_password_policy(password: str) -> Optional[str]:
    """Şifre politikası: None geçerli; aksi halde Türkçe hata mesajı."""
    if len(password) < 8:
        return "Şifre en az 8 karakter olmalı"
    if not any(c.isupper() for c in password):
        return "Şifre en az bir büyük harf içermeli"
    if not any(c.islower() for c in password):
        return "Şifre en az bir küçük harf içermeli"
    if not any(c.isdigit() for c in password):
        return "Şifre en az bir rakam içermeli"
    return None


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def _create_typed_email_token(email: str, typ: str) -> str:
    minutes = getattr(settings, "SIGNUP_JWT_EXPIRE_MINUTES", 15)
    return create_access_token(
        {"sub": email.strip().lower(), "typ": typ},
        expires_delta=timedelta(minutes=minutes),
    )


def _decode_typed_email_token(token: str, typ: str) -> Optional[str]:
    payload = decode_token(token)
    if not payload or payload.get("typ") != typ:
        return None
    sub = payload.get("sub")
    return str(sub).strip().lower() if sub else None


def create_signup_token(email: str) -> str:
    return _create_typed_email_token(email, "signup")


def decode_signup_token(token: str) -> Optional[str]:
    return _decode_typed_email_token(token, "signup")


def create_password_reset_token(email: str) -> str:
    return _create_typed_email_token(email, "pwd_reset")


def decode_password_reset_token(token: str) -> Optional[str]:
    return _decode_typed_email_token(token, "pwd_reset")
