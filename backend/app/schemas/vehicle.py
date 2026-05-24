"""Kullanıcı araç şemaları."""
import re

from pydantic import BaseModel, Field, field_validator


def normalize_plate(raw: str) -> str:
    s = raw.strip().upper()
    s = re.sub(r"\s+", "", s)
    return s


class VehicleCreate(BaseModel):
    plate: str = Field(min_length=2, max_length=32)
    label: str | None = Field(default=None, max_length=100)

    @field_validator("plate")
    @classmethod
    def plate_norm(cls, v: str) -> str:
        n = normalize_plate(v)
        if len(n) < 2:
            raise ValueError("Plaka en az 2 karakter olmalıdır.")
        return n

    @field_validator("label")
    @classmethod
    def strip_label(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        return s or None


class VehicleResponse(BaseModel):
    id: int
    plate: str
    label: str | None
    created_at: str

    class Config:
        from_attributes = True
