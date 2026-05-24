"""API bağımlılıkları - auth, db."""
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models import User

security = HTTPBearer(auto_error=False)


def get_current_user_optional(
    creds: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> Optional[User]:
    """Opsiyonel - token yoksa None döner."""
    if not creds:
        return None
    payload = decode_token(creds.credentials)
    if not payload or "sub" not in payload:
        return None
    user_id = payload.get("sub")
    if isinstance(user_id, str):
        user_id = int(user_id)
    user = db.query(User).filter(User.id == user_id).first()
    return user


def get_current_user(
    user: Annotated[Optional[User], Depends(get_current_user_optional)],
) -> User:
    """Zorunlu - giriş yapmış kullanıcı."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yetkilendirme gerekli",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hesap devre dışı")
    return user


def get_current_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Sadece admin (yönetici) rolü."""
    role_val = user.role.value if hasattr(user.role, "value") else user.role
    if role_val != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetki yok")
    return user


def get_current_staff(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Admin (yönetici) veya operator (operatör)."""
    role_val = user.role.value if hasattr(user.role, "value") else user.role
    if role_val not in ("admin", "operator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetki yok")
    return user
