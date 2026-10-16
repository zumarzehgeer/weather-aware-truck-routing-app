"""Trip payload validation and local-time/DST normalization, independent of HTTP views."""

import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def validate(data):
    """Return normalized planning arguments, or raise ValueError with a user-facing reason."""
    if not isinstance(data, dict):
        raise ValueError("A JSON object is required.")
    origin, destination = data.get("origin"), data.get("destination")
    for name, place in [("Origin", origin), ("Destination", destination)]:
        if (
            not isinstance(place, dict)
            or not isinstance(place.get("name"), str)
            or not 1 <= len(place["name"]) <= 200
        ):
            raise ValueError(f"{name} must be selected from place search.")
        for field, limit in [("latitude", 85), ("longitude", 180)]:
            value = place.get(field)
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not -limit <= value <= limit
                or not math.isfinite(value)
            ):
                raise ValueError(f"{name} has an invalid {field}. Supported latitude is ±85°.")
    if (
        origin["latitude"] == destination["latitude"]
        and origin["longitude"] == destination["longitude"]
    ):
        raise ValueError("Choose different origin and destination places.")
    load = data.get("load_lb")
    if (
        isinstance(load, bool)
        or not isinstance(load, (int, float))
        or not 0 <= load <= 120000
        or not math.isfinite(load)
    ):
        raise ValueError("Load must be between 0 and 120,000 lb.")
    spacing = data.get("spacing_miles")
    if isinstance(spacing, bool) or spacing not in (10, 25, 50):
        raise ValueError("Checkpoint spacing must be 10, 25, or 50 miles.")
    if not isinstance(data.get("demo", False), bool):
        raise ValueError("Demo must be a boolean.")
    try:
        zone = ZoneInfo(data.get("timezone", ""))
        local = datetime.fromisoformat(data.get("departure_local", ""))
        if local.tzinfo is not None:
            raise ValueError("Use a local departure time plus an IANA timezone.")
        aware = local.replace(tzinfo=zone, fold=0)
        if aware.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) != local:
            raise ValueError(
                "This local departure time does not exist because clocks move forward. Choose another time."
            )
        if aware.utcoffset() != local.replace(tzinfo=zone, fold=1).utcoffset():
            raise ValueError(
                "This departure time is repeated when clocks move back. Choose a time outside the repeated hour."
            )
        departure = aware.astimezone(timezone.utc)
    except (ZoneInfoNotFoundError, TypeError, KeyError, OverflowError) as exc:
        raise ValueError("Provide a valid local departure time and IANA timezone.") from exc
    now = datetime.now(timezone.utc)
    if departure < now - timedelta(minutes=5):
        raise ValueError(
            "Departure must be in the future (a five-minute clock tolerance is allowed)."
        )
    if departure > now + timedelta(days=7):
        raise ValueError(
            "Departure is outside the 7-day forecast request horizon. Choose an earlier departure; arrival forecasts may end sooner."
        )
    return origin, destination, departure, load, spacing
