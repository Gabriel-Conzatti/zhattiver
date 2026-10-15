from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

DEFAULT_TZ = ZoneInfo("America/Sao_Paulo")


def now_utc() -> datetime:
    return datetime.now(tz=UTC)


def now_local(tz: ZoneInfo | None = None) -> datetime:
    return datetime.now(tz=tz or DEFAULT_TZ)


def today_local(tz: ZoneInfo | None = None) -> date:
    return now_local(tz).date()


def to_local(dt: datetime, tz: ZoneInfo | None = None) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(tz or DEFAULT_TZ)


def end_of_day_utc(day: date, tz: ZoneInfo | None = None) -> datetime:
    """23h59:59.999999 do dia civil `day` no fuso indicado, convertido para UTC."""
    tz = tz or DEFAULT_TZ
    local_end = datetime.combine(day, datetime.max.time(), tzinfo=tz)
    return local_end.astimezone(UTC)


def start_of_day_utc(day: date, tz: ZoneInfo | None = None) -> datetime:
    tz = tz or DEFAULT_TZ
    local_start = datetime.combine(day, datetime.min.time(), tzinfo=tz)
    return local_start.astimezone(UTC)


__all__ = [
    "DEFAULT_TZ",
    "end_of_day_utc",
    "now_local",
    "now_utc",
    "start_of_day_utc",
    "timedelta",
    "to_local",
    "today_local",
]
