"""Pricing şemaları."""
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class PricingBracketRow(BaseModel):
    label: str
    price: Decimal
    max_minutes: Optional[int] = None


class PricingResponse(BaseModel):
    free_minutes: int
    brackets: list[PricingBracketRow]
    currency: str


class PricingBracketUpdate(BaseModel):
    max_minutes: Optional[int] = Field(None, ge=1, le=24 * 60)
    price: Decimal = Field(ge=0)


class PricingUpdate(BaseModel):
    """Yönetim paneli — gönderilmeyen alanlar değişmez."""

    free_minutes: Optional[int] = Field(None, ge=0, le=24 * 60)
    brackets: Optional[list[PricingBracketUpdate]] = None
    currency: Optional[str] = Field(None, min_length=3, max_length=3)

    @model_validator(mode="after")
    def validate_brackets(self):
        b = self.brackets
        if b is None:
            return self
        if len(b) < 1:
            raise ValueError("En az bir ücret dilimi gerekli")
        for i, row in enumerate(b[:-1]):
            if row.max_minutes is None:
                raise ValueError("Ara dilimlerde üst süre (dakika) zorunludur")
        if b[-1].max_minutes is not None:
            raise ValueError("Son dilimde üst süre boş bırakılmalı (sınırsız / tam gün)")
        prev = 0
        for row in b[:-1]:
            assert row.max_minutes is not None
            if row.max_minutes <= prev:
                raise ValueError("Üst süreler artan sırada olmalıdır")
            prev = row.max_minutes
        return self
