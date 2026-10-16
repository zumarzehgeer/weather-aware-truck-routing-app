"""Shared HTTP error mapping, provider-number validation and cache keys."""

import hashlib
import json
import math
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import httpx
from django.conf import settings


class ProviderError(Exception):
    def __init__(
        self, message, code="provider_unavailable", status=502, *, transient=False, retry_after=None
    ):
        super().__init__(message)
        self.code, self.status = code, status
        self.transient = transient
        self.retry_after = retry_after


def rate_limit_error(response, name):
    """Expose a safe rejection category, without echoing provider URLs or credentials."""
    try:
        data = response.json()
        reason = data.get("reason", "") if isinstance(data, dict) else ""
        reason = reason.casefold() if isinstance(reason, str) else ""
    except (ValueError, RecursionError):
        reason = ""
    retry_after = None
    header = response.headers.get("Retry-After", "")
    if header:
        try:
            retry_after = float(header)
            if not math.isfinite(retry_after) or retry_after < 0:
                retry_after = None
        except ValueError:
            try:
                retry_after = max(
                    0, (parsedate_to_datetime(header) - datetime.now(timezone.utc)).total_seconds()
                )
            except (ValueError, TypeError, OverflowError):
                pass
    transient = "concurrent" in reason or "concurrency" in reason
    if transient:
        message = f"{name} is temporarily busy (concurrent-request limit). Please retry shortly."
    else:
        period = next((p for p in ("daily", "hourly", "minutely") if p in reason), None)
        message = (
            f"{name} {period} quota exceeded. Wait for the provider quota to reset."
            if period
            else f"{name} rate limit reached. Wait before retrying."
        )
    return ProviderError(
        message, "provider_rate_limit", 503, transient=transient, retry_after=retry_after
    )


def key(prefix, data):
    """Create a deterministic cache key for JSON-compatible provider arguments."""
    return prefix + hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def get_json(url, params, name, *, routing_errors=False):
    """Keep timeouts, throttling and malformed JSON behind one provider-error contract."""
    try:
        with httpx.Client(
            timeout=httpx.Timeout(25, connect=8),
            headers={"User-Agent": settings.PROVIDER_USER_AGENT},
        ) as client:
            response = client.get(url, params=params)
            if response.status_code == 429:
                raise rate_limit_error(response, name)
            if routing_errors and response.status_code == 400:
                data = response.json()
                if isinstance(data, dict) and data.get("code") in ("NoRoute", "NoSegment"):
                    return data
            response.raise_for_status()
            return response.json()
    except ProviderError:
        raise
    except (httpx.HTTPError, ValueError, RecursionError) as exc:
        raise ProviderError(
            f"{name} is unavailable. Check provider access and try again. No substitute data was used."
        ) from exc


def finite_number(value, minimum=None, maximum=None):
    """Validate JSON numbers before allowing float arithmetic or date conversion."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("Expected a number")
    if (minimum is not None and value < minimum) or (maximum is not None and value > maximum):
        raise ValueError("Number outside supported bounds")
    try:
        result = float(value)
    except OverflowError as exc:
        raise ValueError("Number outside supported bounds") from exc
    if not math.isfinite(result):
        raise ValueError("Expected a finite number")
    return result
