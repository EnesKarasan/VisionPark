"""ParkingIntent şemaları."""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ParkingIntentCreate(BaseModel):
    kind: Literal["entry", "exit"] = "entry"
    spot_id: Optional[int] = None  # entry için zorunlu
    plate_number: Optional[str] = Field(None, max_length=20)


class ParkingIntentResponse(BaseModel):
    token: str
    kind: Literal["entry", "exit"]
    spot_id: int
    spot_number: Optional[str] = None
    expires_at: datetime
    ttl_minutes: int
    redeem_url: str

    model_config = {"from_attributes": True}
