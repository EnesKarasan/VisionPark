"""Kayıtlı ödeme kartı (maskeli)."""
import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

CardBrand = Literal["visa", "mastercard", "amex", "troy", "other"]


class PaymentCardCreate(BaseModel):
    last_four: str = Field(min_length=4, max_length=4)
    holder_name: str = Field(min_length=1, max_length=120)
    exp_month: int = Field(ge=1, le=12)
    exp_year: int = Field(ge=2020, le=2100)
    brand: CardBrand
    label: str | None = Field(default=None, max_length=80)

    @field_validator("last_four")
    @classmethod
    def digits_four(cls, v: str) -> str:
        s = re.sub(r"\D", "", v)
        if len(s) != 4:
            raise ValueError("Son 4 hane 4 rakam olmalıdır.")
        return s

    @field_validator("holder_name")
    @classmethod
    def strip_holder(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Kart üzerindeki isim zorunludur.")
        return s

    @field_validator("label")
    @classmethod
    def strip_label(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        return s or None


class PaymentCardResponse(BaseModel):
    id: int
    last_four: str
    holder_name: str
    exp_month: int
    exp_year: int
    brand: str
    label: str | None
    created_at: str

    class Config:
        from_attributes = True
