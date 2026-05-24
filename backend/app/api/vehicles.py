"""Kullanıcı araçları (plaka listesi)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.models.user_vehicle import UserVehicle
from app.schemas.vehicle import VehicleCreate, VehicleResponse

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def _to_response(v: UserVehicle) -> VehicleResponse:
    return VehicleResponse(
        id=v.id,
        plate=v.plate,
        label=v.label,
        created_at=v.created_at.isoformat() if v.created_at else "",
    )


@router.get("/my", response_model=list[VehicleResponse])
def list_my_vehicles(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(UserVehicle)
        .filter(UserVehicle.user_id == user.id)
        .order_by(UserVehicle.created_at.desc())
        .all()
    )
    return [_to_response(v) for v in rows]


@router.post("", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
def add_vehicle(
    data: VehicleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = UserVehicle(user_id=user.id, plate=data.plate, label=data.label)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu plaka zaten kayıtlı.",
        )
    db.refresh(row)
    return _to_response(row)


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = (
        db.query(UserVehicle)
        .filter(UserVehicle.id == vehicle_id, UserVehicle.user_id == user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Araç bulunamadı")
    db.delete(row)
    db.commit()
    return None
