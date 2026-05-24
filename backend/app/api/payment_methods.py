"""Kullanıcı kayıtlı kartları (maskeli)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.models.user_payment_card import UserPaymentCard
from app.schemas.payment_card import PaymentCardCreate, PaymentCardResponse

router = APIRouter(prefix="/payment-methods", tags=["payment-methods"])


def _to_response(c: UserPaymentCard) -> PaymentCardResponse:
    return PaymentCardResponse(
        id=c.id,
        last_four=c.last_four,
        holder_name=c.holder_name,
        exp_month=c.exp_month,
        exp_year=c.exp_year,
        brand=c.brand,
        label=c.label,
        created_at=c.created_at.isoformat() if c.created_at else "",
    )


@router.get("/my", response_model=list[PaymentCardResponse])
def list_my_cards(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(UserPaymentCard)
        .filter(UserPaymentCard.user_id == user.id)
        .order_by(UserPaymentCard.created_at.desc())
        .all()
    )
    return [_to_response(c) for c in rows]


@router.post("", response_model=PaymentCardResponse, status_code=status.HTTP_201_CREATED)
def add_card(
    data: PaymentCardCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = UserPaymentCard(
        user_id=user.id,
        last_four=data.last_four,
        holder_name=data.holder_name,
        exp_month=data.exp_month,
        exp_year=data.exp_year,
        brand=data.brand,
        label=data.label,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu kart zaten kayıtlı.",
        )
    db.refresh(row)
    return _to_response(row)


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(
    card_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = (
        db.query(UserPaymentCard)
        .filter(UserPaymentCard.id == card_id, UserPaymentCard.user_id == user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kart bulunamadı")
    db.delete(row)
    db.commit()
    return None
