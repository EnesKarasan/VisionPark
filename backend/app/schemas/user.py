"""User ve Auth şemaları."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str | None
    first_name: str | None = None
    last_name: str | None = None
    birth_date: str | None = None
    gender: str | None = None
    role: str
    is_active: bool
    missed_reservation_entry_count: int = 0
    show_late_entry_warning: bool = False

    class Config:
        from_attributes = True

    @classmethod
    def from_user(cls, user):
        bd = getattr(user, "birth_date", None)
        strikes = int(getattr(user, "missed_reservation_entry_count", 0) or 0)
        return cls(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            first_name=getattr(user, "first_name", None),
            last_name=getattr(user, "last_name", None),
            birth_date=bd.isoformat() if bd is not None else None,
            gender=getattr(user, "gender", None),
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
            is_active=user.is_active,
            missed_reservation_entry_count=strikes,
            show_late_entry_warning=strikes >= 1,
        )


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class CheckEmailRequest(BaseModel):
    email: EmailStr


class CheckEmailResponse(BaseModel):
    exists: bool


class RequestSignupCodeRequest(BaseModel):
    email: EmailStr


class RequestSignupCodeResponse(BaseModel):
    ok: bool = True
    debug_code: str | None = None


class VerifySignupCodeRequest(BaseModel):
    email: EmailStr
    code: str


class VerifySignupCodeResponse(BaseModel):
    signup_token: str


class CompleteSignupRequest(BaseModel):
    signup_token: str
    password: str
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    birth_date: date
    gender: Literal["female", "male", "other", "unspecified"]

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_names(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Ad ve soyad boş olamaz.")
        return s

    @field_validator("birth_date")
    @classmethod
    def must_be_adult(cls, v: date) -> date:
        today = date.today()
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        if age < 18:
            raise ValueError("Kayıt için en az 18 yaşında olmalısınız.")
        return v


class RequestPasswordResetCodeRequest(BaseModel):
    email: EmailStr


class RequestPasswordResetCodeResponse(BaseModel):
    ok: bool = True
    debug_code: str | None = None


class VerifyPasswordResetCodeRequest(BaseModel):
    email: EmailStr
    code: str


class VerifyPasswordResetCodeResponse(BaseModel):
    reset_token: str


class CompletePasswordResetRequest(BaseModel):
    reset_token: str
    password: str


class CompletePasswordResetResponse(BaseModel):
    ok: bool = True


class UserProfileUpdate(BaseModel):
    """Profil: ad, soyad, e-posta (PATCH /auth/me)."""

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_names(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Ad ve soyad boş olamaz.")
        return s


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ChangePasswordResponse(BaseModel):
    ok: bool = True


class DeleteAccountRequest(BaseModel):
    password: str


class DeleteAccountResponse(BaseModel):
    ok: bool = True


# ── Admin: kullanıcı yönetimi ────────────────────────────────────────────


class AdminUserRow(BaseModel):
    id: int
    email: str
    full_name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    role: str
    is_active: bool
    created_at: str | None = None
    missed_reservation_entry_count: int = 0

    class Config:
        from_attributes = True


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None
    role: Literal["admin", "operator", "customer"] = "operator"


class AdminUserUpdate(BaseModel):
    role: Literal["admin", "operator", "customer"] | None = None
    is_active: bool | None = None
    full_name: str | None = None
