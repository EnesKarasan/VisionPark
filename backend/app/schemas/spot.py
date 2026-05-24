"""Spot ve Parking şemaları."""
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from typing import Literal, Optional


class SpotResponse(BaseModel):
    id: int
    spot_number: str
    is_occupied: bool
    is_reserved: bool = False
    bbox: list
    parking_lot_id: int
    section: Optional[str] = None
    row_number: Optional[int] = None

    class Config:
        from_attributes = True


class SpotsSummary(BaseModel):
    total: int
    available: int
    occupied: int
    reserved: int = 0
    spots: list[SpotResponse]
    parking_lot_name: Optional[str] = None


class SpotCreate(BaseModel):
    spot_number: str
    bbox: list[int | float]
    section: Optional[str] = None
    row_number: Optional[int] = None


class SpotBulkSave(BaseModel):
    spots: list[SpotCreate]


class SpotUpdate(BaseModel):
    spot_number: Optional[str] = None
    bbox: Optional[list[int | float]] = None
    section: Optional[str] = None
    row_number: Optional[int] = None


class ParkingSessionStart(BaseModel):
    spot_id: int
    plate_number: Optional[str] = None


class CreateParkingIntentRequest(BaseModel):
    """Giriş veya çıkış için QR token oluşturma isteği.

    `kind="entry"` için `spot_id` zorunludur.
    `kind="exit"` için `spot_id` yok sayılır — backend aktif oturumdan türetir.
    """
    kind: Literal["entry", "exit"] = "entry"
    spot_id: Optional[int] = None
    plate_number: Optional[str] = None


class ParkingSessionResponse(BaseModel):
    id: int
    user_id: int
    spot_id: int
    started_at: datetime
    ended_at: Optional[datetime] = None
    total_fee: Optional[Decimal] = None
    status: str
    spot_number: Optional[str] = None

    class Config:
        from_attributes = True
