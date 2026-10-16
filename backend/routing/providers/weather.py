"""Batched, cached forecasts, unit normalization and arrival-hour lookup."""

import math
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.core.cache import cache

from . import common

_weather_budget_lock = threading.Lock()
# The free API allows one running request per IP; a shared host can fill its small queue.
_weather_slots = threading.BoundedSemaphore(1)


def _cooldown_key():
    return common.key("weather-cooldown:", settings.WEATHER_BASE_URL)


def _request_batch(coords, deadline):
    """Serialize outbound calls and retry only brief concurrency rejections, never quotas."""
    params = {
        "latitude": ",".join(str(c[1]) for c in coords),
        "longitude": ",".join(str(c[0]) for c in coords),
        "hourly": "wind_speed_10m,rain,showers,snowfall",
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": "GMT",
        "timeformat": "unixtime",
        "forecast_days": 7,
    }
    for attempt in range(3):
        # Leave the HTTP timeout inside the frontend's overall request deadline.
        wait = deadline - time.monotonic() - 25
        if wait <= 0 or not _weather_slots.acquire(timeout=wait):
            raise common.ProviderError(
                "Weather service is busy. Retry after the current evaluation finishes."
            )
        try:
            paused = cache.get(_cooldown_key())
            if paused:
                raise common.ProviderError(paused, "provider_rate_limit", 503)
            reserve_weather_budget(len(coords))
            try:
                return common.get_json(
                    settings.WEATHER_BASE_URL + "/v1/forecast", params, "Weather service"
                )
            except common.ProviderError as exc:
                delay = exc.retry_after if exc.retry_after is not None else 2 ** (attempt + 1)
                can_retry = (
                    exc.transient
                    and attempt < 2
                    and delay <= 5
                    and time.monotonic() + delay + 25 < deadline
                )
                if not can_retry:
                    if exc.code == "provider_rate_limit":
                        cooldown = (
                            exc.retry_after
                            if exc.retry_after is not None
                            else (5 if exc.transient else 60)
                        )
                        cache.set(_cooldown_key(), str(exc), max(1, min(cooldown, 86400)))
                    raise
        finally:
            _weather_slots.release()
        time.sleep(delay)


def reserve_weather_budget(locations):
    """Single-worker assessment budget, counted by locations even when batched."""
    epoch = int(time.time())
    limits = [(60, 500), (3600, 4500), (86400, 9000)]
    with _weather_budget_lock:
        entries = [
            (f"weather-budget:{period}:{epoch//period}", limit, period) for period, limit in limits
        ]
        if any(cache.get(name, 0) + locations > limit for name, limit, period in entries):
            raise common.ProviderError(
                "Weather request budget reached. Reuse a cached trip or retry later; unavailable data remains unknown.",
                "provider_rate_limit",
                503,
            )
        for name, limit, period in entries:
            cache.set(name, cache.get(name, 0) + locations, period + 60)


def convert(value, unit, kind):
    try:
        value = common.finite_number(value, 0)
    except ValueError:
        return None
    factors = {
        "wind": {"mp/h": 1, "mph": 1, "km/h": 1 / 1.609344, "m/s": 2.2369362921, "kn": 1.150779448},
        "precip": {"inch": 1, "in": 1, "mm": 1 / 25.4, "cm": 1 / 2.54},
    }
    factor = factors[kind].get(unit) if isinstance(unit, str) else None
    # Eliminate binary conversion dust at exact assessment boundaries (e.g. 6.35 mm = .25 in).
    converted = value * factor if factor is not None else None
    return round(converted, 10) if converted is not None and math.isfinite(converted) else None


def parse_forecast(data):
    if (
        not isinstance(data, dict)
        or not isinstance(data.get("hourly"), dict)
        or not isinstance(data.get("hourly_units"), dict)
    ):
        raise ValueError("Expected hourly forecast objects")
    hourly, units = data["hourly"], data["hourly_units"]
    times = hourly["time"]
    fields = ["wind_speed_10m", "rain", "showers", "snowfall"]
    if not isinstance(times, list) or any(
        not isinstance(hourly.get(f), list) or len(hourly[f]) != len(times) for f in fields
    ):
        raise ValueError("Mismatched hourly arrays")
    result = []
    for i, timestamp in enumerate(times):
        try:
            if isinstance(timestamp, str):
                dt = datetime.fromisoformat(timestamp)
                dt = (
                    dt.replace(tzinfo=timezone.utc)
                    if dt.tzinfo is None
                    else dt.astimezone(timezone.utc)
                )
            else:
                dt = datetime.fromtimestamp(common.finite_number(timestamp), timezone.utc)
        except (OSError, OverflowError) as exc:
            raise ValueError("Invalid forecast timestamp") from exc
        rain = convert(hourly["rain"][i], units.get("rain"), "precip")
        showers = convert(hourly["showers"][i], units.get("showers"), "precip")
        result.append(
            {
                "time": dt.isoformat(),
                "wind_mph": convert(
                    hourly["wind_speed_10m"][i], units.get("wind_speed_10m"), "wind"
                ),
                "rain_in": (
                    round(rain + showers, 10)
                    if rain is not None and showers is not None and math.isfinite(rain + showers)
                    else None
                ),
                "snow_in": convert(hourly["snowfall"][i], units.get("snowfall"), "precip"),
            }
        )
    return result


def location_key(coordinate):
    return tuple(round(x, 3) for x in coordinate)


def forecasts(coordinates):
    coordinates = list(dict.fromkeys(location_key(c) for c in coordinates))
    result, pending, warnings = {}, [], []
    for c in coordinates:
        stored = cache.get(common.key("weather:", c))
        if stored is not None:
            result[c] = stored
        else:
            pending.append(c)

    deadline = time.monotonic() + 85

    def batch(coords):
        try:
            raw = _request_batch(coords, deadline)
            data = raw if isinstance(raw, list) else [raw]
            if len(data) != len(coords):
                raise ValueError("Wrong location count")
            parsed = [parse_forecast(d) for d in data]
            for c, value in zip(coords, parsed):
                cache.set(common.key("weather:", c), value, 1800)
            return dict(zip(coords, parsed)), None
        except (common.ProviderError, KeyError, TypeError, ValueError, OverflowError) as exc:
            return {c: [] for c in coords}, (
                str(exc)
                if isinstance(exc, common.ProviderError)
                else "Weather service returned incomplete or invalid forecast data."
            )

    batches = [pending[i : i + 40] for i in range(0, len(pending), 40)]
    with ThreadPoolExecutor(max_workers=3) as pool:
        for values, warning in pool.map(batch, batches):
            result.update(values)
            if warning:
                warnings.append(warning)
    return result, list(dict.fromkeys(warnings))


def weather_at(series, arrival):
    """Forecast labelled H represents the preceding hour's precipitation; choose ceil(ETA)."""
    try:
        utc_arrival = arrival.astimezone(timezone.utc)
        target = utc_arrival.replace(minute=0, second=0, microsecond=0)
        if target < utc_arrival:
            target += timedelta(hours=1)
    except (OverflowError, ValueError):
        return None
    for item in series:
        if datetime.fromisoformat(item["time"]) == target:
            return item
    return None
