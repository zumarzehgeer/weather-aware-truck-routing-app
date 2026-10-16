"""HTTP endpoints: response shaping, request limits and dispatch to trip services."""

import json
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from django.http import FileResponse, JsonResponse
from django.views.decorators.http import require_GET, require_POST

from .providers.common import ProviderError, key
from .providers.geocoding import geocode as search_places
from .service import build_plan
from .validation import validate


def error(message, code="validation_error", status=400):
    return JsonResponse({"error": {"code": code, "message": message}}, status=status)


def throttle(request, kind, limit):
    # REMOTE_ADDR is intentionally used instead of trusting arbitrary forwarded headers.
    identity = request.META.get("REMOTE_ADDR", "unknown")
    minute = int(datetime.now(timezone.utc).timestamp() // 60)
    name = key("throttle:", [kind, identity, minute])
    cache.add(name, 0, 90)
    try:
        count = cache.incr(name)
    except ValueError:
        cache.set(name, 1, 90)
        count = 1
    return count > limit


@require_GET
def health(request):
    return JsonResponse({"status": "ok", "demo_enabled": settings.ENABLE_DEMO})


@require_GET
def geocode(request):
    query = request.GET.get("q", "").strip()
    if not 2 <= len(query) <= 100:
        return error("Search must contain 2–100 characters.")
    if throttle(request, "geocode", 30):
        return error("Too many searches. Please wait a minute.", "rate_limit", 429)
    try:
        return JsonResponse({"results": search_places(query)})
    except ProviderError as exc:
        return error(str(exc), exc.code, exc.status)


@require_POST
def plan(request):
    if request.content_type != "application/json":
        return error("Use application/json.", "unsupported_media_type", 415)
    try:
        data = json.loads(request.body)
        args = validate(data)
    except (
        json.JSONDecodeError,
        ValueError,
        UnicodeDecodeError,
        RecursionError,
    ) as exc:
        return error(str(exc))
    demo = data.get("demo", False)
    if demo and not settings.ENABLE_DEMO:
        return error("Demo mode is disabled.", "demo_disabled", 403)
    if throttle(request, "plan", 8):
        return error(
            "Too many trip evaluations. Wait a minute before retrying.",
            "rate_limit",
            429,
        )
    try:
        return JsonResponse(build_plan(*args, demo=demo))
    except ProviderError as exc:
        return error(str(exc), exc.code, exc.status)


@require_GET
def index(request):
    path = Path(settings.BASE_DIR).parent / "frontend/dist/index.html"
    if not path.exists():
        return error(
            "Frontend is not built. Run npm ci and npm run build in frontend, or use the Vite development server.",
            "frontend_not_built",
            503,
        )
    return FileResponse(path.open("rb"), content_type="text/html")
