"""Browser-assisted public forecasts; routes and risk calculations remain server-owned.

Weather is transported by the visitor's browser and is explicitly identified as such.
It is untrusted input, not a server-authenticated provider response. No results are
persisted or shared between users. Prepared routes are never accepted from clients.
"""

import json
import secrets
import threading

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from .providers.common import ProviderError
from .providers.weather import location_key, parse_forecast
from .service import evaluate_plan, prepare_plan
from .validation import validate
from .views import error, throttle

_completion_lock = threading.Lock()
_SESSION_PREFIX = "prepared-browser-trip:"


@require_POST
def prepare(request):
    if settings.WEATHER_TRANSPORT != "browser":
        return error("Browser weather transport is disabled.", "transport_disabled", 403)
    if request.content_type != "application/json":
        return error("Use application/json.", "unsupported_media_type", 415)
    try:
        if len(request.body) > 16384:
            raise ValueError("Trip input is too large.")
        data = json.loads(request.body)
        args = validate(data)
        if data.get("demo", False):
            raise ValueError("Use the normal plan endpoint for the synthetic demo.")
    except (ValueError, UnicodeDecodeError, RecursionError) as exc:
        return error(str(exc))
    if throttle(request, "plan", 8):
        return error("Too many trip evaluations. Wait a minute before retrying.", "rate_limit", 429)
    try:
        prepared = prepare_plan(*args)
    except ProviderError as exc:
        return error(str(exc), exc.code, exc.status)
    locations = list(dict.fromkeys(location_key(c) for c in prepared["locations"]))
    prepared["locations"] = locations
    token = secrets.token_urlsafe(32)
    cache.set(_SESSION_PREFIX + token, prepared, 180)
    response = JsonResponse({"token": token, "locations": locations})
    response["Cache-Control"] = "no-store"
    return response


def _normalize_weather(locations, batches):
    series, warnings = {}, []
    for index, offset in enumerate(range(0, len(locations), 40)):
        coords = locations[offset : offset + 40]
        raw = batches[index]
        try:
            entries = raw if isinstance(raw, list) else [raw]
            if len(entries) != len(coords):
                raise ValueError("Wrong location count")
            parsed = []
            for entry in entries:
                if not isinstance(entry, dict) or not isinstance(entry.get("hourly"), dict):
                    raise ValueError("Missing hourly data")
                times = entry["hourly"].get("time")
                if not isinstance(times, list) or len(times) > 192:
                    raise ValueError("Invalid forecast horizon")
                parsed.append(parse_forecast(entry))
            series.update(zip(coords, parsed))
        except (ValueError, TypeError, KeyError, OverflowError):
            series.update((c, []) for c in coords)
            warnings.append(
                "Some weather could not be retrieved by your browser. Check provider access and try again; missing forecasts remain Unknown."
            )
    return series, list(dict.fromkeys(warnings))


@require_POST
def complete(request):
    if settings.WEATHER_TRANSPORT != "browser":
        return error("Browser weather transport is disabled.", "transport_disabled", 403)
    if request.content_type != "application/json":
        return error("Use application/json.", "unsupported_media_type", 415)
    try:
        data = json.loads(request.body)
        if not isinstance(data, dict):
            raise ValueError("A JSON object is required.")
        token, batches = data.get("token"), data.get("weather_batches")
        if not isinstance(token, str) or len(token) != 43 or not isinstance(batches, list):
            raise ValueError("Invalid prepared trip or weather batches.")
        with _completion_lock:
            prepared = cache.get(_SESSION_PREFIX + token)
            if prepared is None:
                return error(
                    "This trip preparation expired or was already used. Compare again.",
                    "plan_expired",
                    409,
                )
            if len(batches) != (len(prepared["locations"]) + 39) // 40:
                raise ValueError("Wrong number of weather batches.")
            cache.delete(_SESSION_PREFIX + token)
    except (ValueError, UnicodeDecodeError, RecursionError) as exc:
        return error(str(exc))
    series, warnings = _normalize_weather(prepared["locations"], batches)
    return JsonResponse(evaluate_plan(prepared, series, warnings, weather_transport="browser"))
