"""Provider congestion retries must not amplify exhausted quotas or invent forecasts."""

from unittest.mock import patch

import httpx
import pytest

from routing.providers import common, weather

from .test_boundaries import hourly_forecast


@pytest.mark.parametrize(
    "reason, category, transient",
    [
        ("Too many concurrent requests", "concurrent-request limit", True),
        ("Concurrency limit reached", "concurrent-request limit", True),
        ("Daily API request limit exceeded. Please try again tomorrow.", "daily quota", False),
        ("Hourly API request limit exceeded", "hourly quota", False),
        ("Minutely API request limit exceeded", "minutely quota", False),
        ("Unexpected error with sensitive upstream details", "rate limit reached", False),
    ],
)
def test_rate_limit_category_is_safe_and_specific(reason, category, transient):
    response = httpx.Response(429, json={"error": True, "reason": reason})
    error = common.rate_limit_error(response, "Weather service")
    assert category in str(error)
    assert error.transient is transient
    assert error.code == "provider_rate_limit" and error.status == 503
    assert "sensitive upstream details" not in str(error)


@pytest.mark.parametrize(
    "header, expected", [("15", 15), ("nan", None), ("-3", None), ("garbage", None)]
)
def test_retry_after_is_validated(header, expected):
    response = httpx.Response(429, headers={"Retry-After": header}, json={})
    assert common.rate_limit_error(response, "Weather service").retry_after == expected


def test_concurrency_rejection_retries_then_caches_real_forecast():
    busy = common.ProviderError("Weather service busy", "provider_rate_limit", 503, transient=True)
    with (
        patch("routing.providers.common.get_json", side_effect=[busy, hourly_forecast()]) as fetch,
        patch("routing.providers.weather.time.sleep") as sleep,
    ):
        values, warnings = weather.forecasts([[0, 0]])
        cached, cached_warnings = weather.forecasts([[0, 0]])
    assert values[(0, 0)] and values == cached
    assert not warnings and not cached_warnings
    assert fetch.call_count == 2
    sleep.assert_called_once_with(2)


def test_quota_failure_pauses_remaining_batches_and_followup_requests():
    quota = common.ProviderError("Weather service daily quota exceeded", "provider_rate_limit", 503)
    with (
        patch("routing.providers.common.get_json", side_effect=quota) as fetch,
        patch("routing.providers.weather.time.sleep") as sleep,
    ):
        values, warnings = weather.forecasts([[i / 100, 0] for i in range(80)])
        again, again_warnings = weather.forecasts([[2, 0]])
    assert fetch.call_count == 1
    sleep.assert_not_called()
    assert all(value == [] for value in values.values()) and again[(2, 0)] == []
    assert warnings == again_warnings == [str(quota)]


def test_long_retry_after_is_respected_without_immediate_retry():
    busy = common.ProviderError(
        "Weather service busy", "provider_rate_limit", 503, transient=True, retry_after=60
    )
    with (
        patch("routing.providers.common.get_json", side_effect=busy) as fetch,
        patch("routing.providers.weather.time.sleep") as sleep,
    ):
        weather.forecasts([[0, 0]])
        weather.forecasts([[1, 0]])
    assert fetch.call_count == 1
    sleep.assert_not_called()


def test_congestion_retry_count_is_bounded_and_missing_data_stays_unknown():
    busy = common.ProviderError("Weather service busy", "provider_rate_limit", 503, transient=True)
    with (
        patch("routing.providers.common.get_json", side_effect=busy) as fetch,
        patch("routing.providers.weather.time.sleep") as sleep,
    ):
        values, warnings = weather.forecasts([[0, 0]])
    assert fetch.call_count == 3 and sleep.call_count == 2
    assert values == {(0, 0): []} and warnings == [str(busy)]


def test_valid_cached_weather_remains_available_during_provider_cooldown():
    with patch("routing.providers.common.get_json", return_value=hourly_forecast()):
        original, _ = weather.forecasts([[0, 0]])
    quota = common.ProviderError("Weather service daily quota exceeded", "provider_rate_limit", 503)
    with patch("routing.providers.common.get_json", side_effect=quota) as fetch:
        weather.forecasts([[1, 0]])
        cached, warnings = weather.forecasts([[0, 0]])
    assert fetch.call_count == 1
    assert cached == original and not warnings
