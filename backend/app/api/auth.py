"""Auth API - login, signup doğrulama, profil."""
import os
from sqlalchemy import func
from sqlalchemy.orm import Session

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    validate_password_policy,
    create_access_token,
    create_signup_token,
    decode_signup_token,
    create_password_reset_token,
    decode_password_reset_token,
)
from app.models import User
from app.models.signup_verification import SignupVerification
from app.models.password_reset_verification import PasswordResetVerification
from app.models.user import UserRole
from app.schemas.user import (
    UserLogin,
    UserResponse,
    Token,
    CheckEmailRequest,
    CheckEmailResponse,
    RequestSignupCodeRequest,
    RequestSignupCodeResponse,
    VerifySignupCodeRequest,
    VerifySignupCodeResponse,
    CompleteSignupRequest,
    RequestPasswordResetCodeRequest,
    RequestPasswordResetCodeResponse,
    VerifyPasswordResetCodeRequest,
    VerifyPasswordResetCodeResponse,
    CompletePasswordResetRequest,
    CompletePasswordResetResponse,
    UserProfileUpdate,
    ChangePasswordRequest,
    ChangePasswordResponse,
    DeleteAccountRequest,
    DeleteAccountResponse,
)
from app.services.verification_codes import request_verification_code, verify_verification_code
from app.services.user_account import delete_customer_user
from app.api.deps import get_current_user
from app.core.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


def _norm_email(email: str) -> str:
    return email.strip().lower()


@router.post("/check-email", response_model=CheckEmailResponse)
def check_email(data: CheckEmailRequest, db: Session = Depends(get_db)):
    exists = (
        db.query(User.id)
        .filter(func.lower(User.email) == _norm_email(str(data.email)))
        .first()
        is not None
    )
    return CheckEmailResponse(exists=exists)


@router.post("/request-signup-code", response_model=RequestSignupCodeResponse)
def request_signup_code(data: RequestSignupCodeRequest, db: Session = Depends(get_db)):
    email = _norm_email(str(data.email))
    debug_code = request_verification_code(
        db, email, SignupVerification, user_must_exist=False
    )
    return RequestSignupCodeResponse(ok=True, debug_code=debug_code)


@router.post("/verify-signup-code", response_model=VerifySignupCodeResponse)
def verify_signup_code(data: VerifySignupCodeRequest, db: Session = Depends(get_db)):
    email = _norm_email(str(data.email))
    token = verify_verification_code(
        db, email, data.code, SignupVerification, create_signup_token
    )
    return VerifySignupCodeResponse(signup_token=token)


@router.post("/complete-signup", response_model=Token)
def complete_signup(data: CompleteSignupRequest, db: Session = Depends(get_db)):
    email = decode_signup_token(data.signup_token.strip())
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş kayıt bağlantısı",
        )

    if db.query(User.id).filter(func.lower(User.email) == email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu e-posta adresi zaten kayıtlı",
        )

    pwd_err = validate_password_policy(data.password)
    if pwd_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pwd_err)

    full_name = f"{data.first_name} {data.last_name}".strip()
    user = User(
        email=email,
        hashed_password=get_password_hash(data.password),
        full_name=full_name or None,
        first_name=data.first_name,
        last_name=data.last_name,
        birth_date=data.birth_date,
        gender=data.gender,
        role=UserRole.customer,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(data={"sub": str(user.id), "email": user.email})
    return Token(access_token=token, user=UserResponse.from_user(user))


@router.post("/request-password-reset-code", response_model=RequestPasswordResetCodeResponse)
def request_password_reset_code(data: RequestPasswordResetCodeRequest, db: Session = Depends(get_db)):
    email = _norm_email(str(data.email))
    debug_code = request_verification_code(
        db, email, PasswordResetVerification, user_must_exist=True
    )
    return RequestPasswordResetCodeResponse(ok=True, debug_code=debug_code)


@router.post("/verify-password-reset-code", response_model=VerifyPasswordResetCodeResponse)
def verify_password_reset_code(data: VerifyPasswordResetCodeRequest, db: Session = Depends(get_db)):
    email = _norm_email(str(data.email))
    token = verify_verification_code(
        db, email, data.code, PasswordResetVerification, create_password_reset_token
    )
    return VerifyPasswordResetCodeResponse(reset_token=token)


@router.post("/complete-password-reset", response_model=CompletePasswordResetResponse)
def complete_password_reset(data: CompletePasswordResetRequest, db: Session = Depends(get_db)):
    email = decode_password_reset_token(data.reset_token.strip())
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş sıfırlama bağlantısı",
        )

    user = db.query(User).filter(func.lower(User.email) == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")

    pwd_err = validate_password_policy(data.password)
    if pwd_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pwd_err)

    user.hashed_password = get_password_hash(data.password)
    db.commit()
    return CompletePasswordResetResponse()


@router.post("/google-login", response_model=Token)
async def google_login(data: dict, db: Session = Depends(get_db)):
    access_token = data.get("access_token", "").strip()
    if not access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="access_token gerekli")

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google doğrulaması başarısız")

    info = resp.json()
    email = (info.get("email") or "").strip().lower()
    if not email or not info.get("email_verified"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google hesabında doğrulanmış e-posta bulunamadı")

    user = db.query(User).filter(func.lower(User.email) == email).first()
    if not user:
        first_name = (info.get("given_name") or "").strip()
        last_name = (info.get("family_name") or "").strip()
        user = User(
            email=email,
            hashed_password=get_password_hash(os.urandom(32).hex()),
            full_name=(info.get("name") or "").strip() or None,
            first_name=first_name or None,
            last_name=last_name or None,
            role=UserRole.customer,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hesap devre dışı")

    token = create_access_token(data={"sub": str(user.id), "email": user.email})
    return Token(access_token=token, user=UserResponse.from_user(user))


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta veya şifre hatalı",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hesap devre dışı")
    token = create_access_token(data={"sub": str(user.id), "email": user.email})
    return Token(access_token=token, user=UserResponse.from_user(user))


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return UserResponse.from_user(user)


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: UserProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fn = data.first_name.strip()
    ln = data.last_name.strip()
    new_email = _norm_email(str(data.email))
    if new_email != _norm_email(user.email):
        taken = (
            db.query(User.id)
            .filter(func.lower(User.email) == new_email, User.id != user.id)
            .first()
        )
        if taken:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bu e-posta adresi kullanımda.",
            )
    user.first_name = fn
    user.last_name = ln
    user.email = new_email
    user.full_name = f"{fn} {ln}".strip() or None
    db.commit()
    db.refresh(user)
    return UserResponse.from_user(user)


@router.post("/change-password", response_model=ChangePasswordResponse)
def change_password(
    data: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mevcut şifre hatalı",
        )
    if data.current_password == data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yeni şifre mevcut şifre ile aynı olamaz",
        )
    pwd_err = validate_password_policy(data.new_password)
    if pwd_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pwd_err)
    user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return ChangePasswordResponse()


@router.post("/delete-account", response_model=DeleteAccountResponse)
def delete_account(
    data: DeleteAccountRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yönetici hesabı bu yolla silinemez",
        )
    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Şifre hatalı",
        )
    delete_customer_user(db, user)
    db.commit()
    return DeleteAccountResponse()
