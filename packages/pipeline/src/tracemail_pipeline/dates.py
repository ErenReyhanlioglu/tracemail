"""Day arithmetic shared by the command line and the Airflow entry points.

All days are UTC calendar days, the partition boundary of every zone
(CLAUDE.md, Raw Layer).
"""

from datetime import UTC, date, datetime, time, timedelta

ONE_DAY = timedelta(days=1)


def day_start_utc(day: date) -> datetime:
    """Return midnight UTC at the start of a day."""
    return datetime.combine(day, time.min, tzinfo=UTC)


def days_between(start: date, end: date) -> list[date]:
    """Every day in ``[start, end)``."""
    return [start + ONE_DAY * offset for offset in range((end - start).days)]
