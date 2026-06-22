import math
import time
from collections import defaultdict
from datetime import datetime, timezone


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres between two (lat, lng) points."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def approx_lat_lng(lat: float, lng: float, precision: int = 2) -> tuple[float, float]:
    """Round coordinates to ~1 km precision (2 dp) for public display."""
    return round(lat, precision), round(lng, precision)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def utc_timestamp() -> int:
    return int(time.time())


class InMemoryRateLimiter:
    """Simple sliding-window rate limiter. Resets on process restart (fine for hackathon)."""

    def __init__(self) -> None:
        self._store: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str, limit: int, window_seconds: int) -> bool:
        now = time.monotonic()
        cutoff = now - window_seconds
        calls = [t for t in self._store[key] if t > cutoff]
        if len(calls) >= limit:
            self._store[key] = calls
            return False
        calls.append(now)
        self._store[key] = calls
        return True

    def remaining(self, key: str, limit: int, window_seconds: int) -> int:
        now = time.monotonic()
        cutoff = now - window_seconds
        calls = [t for t in self._store.get(key, []) if t > cutoff]
        return max(0, limit - len(calls))


# Singletons
rate_limiter = InMemoryRateLimiter()
