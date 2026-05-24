"""Reservation şemaları."""
from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class ReservationCreate(BaseModel):
    spot_id: int
    plate_number: Optional[str] = None
    scheduled_start_at: Optional[datetime] = None


class ReservationResponse(BaseModel):
    id: int
    user_id: int
    spot_id: int
    spot_number: Optional[str] = None
    reserved_at: datetime
    expires_at: datetime
    scheduled_start_at: Optional[datetime] = None
    entry_deadline_at: Optional[datetime] = None
    status: str
    plate_number: Optional[str] = None

    class Config:
        from_attributes = True
