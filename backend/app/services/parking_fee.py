"""Otopark ücreti — ücretsiz süre + süre dilimlerine göre sabit tutarlar."""
from __future__ import annotations

from copy import deepcopy
from decimal import Decimal
from typing import Any, Optional

# Varsayılan tarife (DB'de pricing_rules yoksa veya geçersizse kullanılır)
DEFAULT_PRICING_RULES: dict[str, Any] = {
    "free_minutes": 15,
    "brackets": [
        {"max_minutes": 60, "price": "110"},
        {"max_minutes": 120, "price": "140"},
        {"max_minutes": 240, "price": "170"},
        {"max_minutes": 480, "price": "220"},
        {"max_minutes": 720, "price": "260"},
        {"price": "370"},
    ],
}

BRACKET_LABELS = (
    "0-1 saat",
    "1-2 saat",
    "2-4 saat",
    "4-8 saat",
    "8-12 saat",
    "Tam gün",
)


def _bracket_price(b: dict[str, Any]) -> Decimal:
    return Decimal(str(b.get("price", "0")))


def resolved_pricing_rules(stored: Optional[dict[str, Any]]) -> dict[str, Any]:
    """DB'deki JSON ile varsayılanı birleştirir; bozuksa varsayılanı döner."""
    if not stored or not isinstance(stored, dict):
        return deepcopy(DEFAULT_PRICING_RULES)
    free = stored.get("free_minutes")
    raw_brackets = stored.get("brackets")
    if not isinstance(free, int) or free < 0 or free > 24 * 60:
        return deepcopy(DEFAULT_PRICING_RULES)
    if not isinstance(raw_brackets, list) or len(raw_brackets) < 1:
        return deepcopy(DEFAULT_PRICING_RULES)
    brackets: list[dict[str, Any]] = []
    for i, b in enumerate(raw_brackets):
        if not isinstance(b, dict) or "price" not in b:
            return deepcopy(DEFAULT_PRICING_RULES)
        entry: dict[str, Any] = {"price": str(_bracket_price(b))}
        mm = b.get("max_minutes")
        if mm is not None:
            if not isinstance(mm, int) or mm < 1:
                return deepcopy(DEFAULT_PRICING_RULES)
            entry["max_minutes"] = mm
        elif i != len(raw_brackets) - 1:
            return deepcopy(DEFAULT_PRICING_RULES)
        brackets.append(entry)
    if brackets[-1].get("max_minutes") is not None:
        return deepcopy(DEFAULT_PRICING_RULES)
    prev = 0
    for b in brackets[:-1]:
        m = b["max_minutes"]
        if m <= prev:
            return deepcopy(DEFAULT_PRICING_RULES)
        prev = m
    return {"free_minutes": free, "brackets": brackets}


def compute_parking_fee(duration_minutes: float, rules: Optional[dict[str, Any]]) -> Decimal:
    """Toplam park süresine göre ücret (ücretsiz süre: girişten itibaren ilk N dakika)."""
    r = resolved_pricing_rules(rules)
    free = r["free_minutes"]
    if duration_minutes <= free:
        return Decimal("0")
    for b in r["brackets"]:
        max_m = b.get("max_minutes")
        price = _bracket_price(b)
        if max_m is None:
            return price
        if duration_minutes <= max_m:
            return price
    return _bracket_price(r["brackets"][-1])


def get_lot_pricing_rules(db, lot_id: int) -> Optional[dict[str, Any]]:
    """Aktif otopark ücret kuralları; kayıt yoksa None."""
    from app.models import Pricing

    pricing = db.query(Pricing).filter(Pricing.parking_lot_id == lot_id).first()
    if not pricing:
        return None
    return rules_for_api_response(pricing.pricing_rules, "TRY")


def rules_for_api_response(rules: Optional[dict[str, Any]], currency: str) -> dict[str, Any]:
    """GET /pricing ve panel için etiketli dilimler."""
    r = resolved_pricing_rules(rules)
    out_brackets = []
    for i, b in enumerate(r["brackets"]):
        label = BRACKET_LABELS[i] if i < len(BRACKET_LABELS) else f"Süre dilimi {i + 1}"
        item: dict[str, Any] = {
            "label": label,
            "price": _bracket_price(b),
        }
        if b.get("max_minutes") is not None:
            item["max_minutes"] = b["max_minutes"]
        out_brackets.append(item)
    return {
        "free_minutes": r["free_minutes"],
        "brackets": out_brackets,
        "currency": currency,
    }
