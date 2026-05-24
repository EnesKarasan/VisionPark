"""Park alanı özet sayıları."""


def compute_spot_counts(spots: list) -> dict[str, int]:
    reserved = sum(1 for s in spots if s.is_reserved)
    available = sum(1 for s in spots if not s.is_occupied and not s.is_reserved)
    occupied = len(spots) - available - reserved
    return {
        "total": len(spots),
        "available": available,
        "occupied": occupied,
        "reserved": reserved,
    }
