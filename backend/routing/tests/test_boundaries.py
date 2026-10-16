"""Regressions for untrusted JSON/provider boundaries and concurrent evaluation."""

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Event, Lock
from unittest.mock import patch

import httpx
import pytest
from django.core.cache import cache

from routing.providers import common, weather
from routing.geometry import corridor_cells, coarse_corridor, haversine, sample_route
from routing.service import build_plan
from .factories import trip_payload, osrm_route


@pytest.mark.parametrize("field", ["load_lb", "latitude", "longitude"])
@pytest.mark.parametrize("value", [10**400, -(10**400)])
def test_extreme_json_numbers_are_validation_errors(client, field, value):
    data = trip_payload()
    if field == "load_lb":
        data[field] = value
    else:
        data["origin"][field] = value
    response = client.post("/api/plan", data=json.dumps(data), content_type="application/json")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"


@pytest.mark.parametrize(
    "local,zone",
    [
        ("0001-01-01T00:00", "Asia/Kolkata"),
        ("9999-12-31T23:59", "America/New_York"),
        ([], "UTC"),
        ("2026-10-16T08:00", []),
    ],
)
def test_malformed_or_overflowing_local_date_is_validation_error(client, local, zone):
    data = trip_payload()
    data.update(departure_local=local, timezone=zone)
    response = client.post("/api/plan", data=json.dumps(data), content_type="application/json")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"


def test_deeply_nested_json_is_a_structured_validation_error(client):
    response = client.post(
        "/api/plan", data="[" * 1500 + "0" + "]" * 1500, content_type="application/json"
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"


@pytest.mark.parametrize(
    "raw",
    [
        [],
        {"results": {}},
        {"results": ["invalid"]},
        {"results": [{"name": "Town", "latitude": 10**400, "longitude": 0}]},
        {"results": [{"name": "Town", "latitude": True, "longitude": 0}]},
        {"results": [{"name": "Town", "latitude": 0, "longitude": 181}]},
    ],
)
def test_malformed_geocoding_stays_json_provider_error(client, raw):
    with patch("routing.providers.common.get_json", return_value=raw):
        response = client.get("/api/geocode?q=Town")
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "provider_unavailable"


@pytest.mark.parametrize(
    "code,status,expected",
    [
        ("NoRoute", 400, 422),
        ("NoSegment", 400, 422),
        ("InvalidQuery", 400, 502),
        ("NoRoute", 403, 502),
        ("NoRoute", 500, 502),
        ("NoRoute", 429, 503),
    ],
)
def test_osrm_error_mapping_through_http_layer(client, code, status, expected):
    response = httpx.Response(
        status, json={"code": code}, request=httpx.Request("GET", "https://example.test")
    )
    data = trip_payload()
    data["demo"] = False
    with (
        patch("routing.providers.common.httpx.Client.get", return_value=response),
        patch("routing.providers.routing.time.sleep"),
    ):
        result = client.post("/api/plan", data=json.dumps(data), content_type="application/json")
    assert result.status_code == expected
    assert result.json()["error"]["code"] == (
        "no_route"
        if expected == 422
        else "provider_rate_limit" if expected == 503 else "provider_unavailable"
    )


@pytest.mark.parametrize(
    "field,value",
    [
        ("geometry", []),
        ("legs", [None]),
        ("duration", 10**400),
        ("distance", True),
        ("coordinates", [[0, 0], [181, 0]]),
        ("coordinates", [[0, 0], None]),
        ("edge_distances", [True]),
        ("edge_distances", [10**400]),
    ],
)
def test_malformed_routing_is_controlled_provider_error(client, field, value):
    route = osrm_route()
    if field == "coordinates":
        route["geometry"]["coordinates"] = value
    elif field == "edge_distances":
        route["legs"][0]["annotation"]["distance"] = value
    else:
        route[field] = value
    data = trip_payload()
    data["demo"] = False
    with (
        patch("routing.providers.common.get_json", return_value={"code": "Ok", "routes": [route]}),
        patch("routing.providers.routing.time.sleep"),
    ):
        result = client.post("/api/plan", data=json.dumps(data), content_type="application/json")
    assert result.status_code == 502
    assert result.json()["error"]["code"] == "provider_unavailable"


def hourly_forecast():
    return {
        "hourly_units": {
            "wind_speed_10m": "mph",
            "rain": "inch",
            "showers": "inch",
            "snowfall": "inch",
        },
        "hourly": {
            "time": [1792108800],
            "wind_speed_10m": [10],
            "rain": [0],
            "showers": [0],
            "snowfall": [0],
        },
    }


@pytest.mark.parametrize(
    "field,value",
    [
        ("hourly_units", []),
        ("hourly", []),
        ("time", [10**400]),
        ("time", [True]),
        ("time", [1e18]),
        ("wind_speed_10m", []),
        ("time", ["invalid-date"]),
    ],
)
def test_malformed_forecast_batch_becomes_unknown_and_warns(field, value):
    invalid = hourly_forecast()
    (invalid if field in ("hourly_units", "hourly") else invalid["hourly"])[field] = value
    # One malformed member must not throw from the executor or cache false calm data.
    with patch("routing.providers.common.get_json", return_value=[hourly_forecast(), invalid]):
        values, warnings = weather.forecasts([[0, 0], [1, 1]])
    assert values == {(0, 0): [], (1, 1): []}
    assert warnings
    assert cache.get(common.key("weather:", (0, 0))) is None


@pytest.mark.parametrize("value,unit", [(10**400, "mph"), (1e308, "m/s"), (True, "mph"), (20, [])])
def test_unusable_weather_measurement_stays_unknown(value, unit):
    assert weather.convert(value, unit, "wind") is None


def test_weather_concurrency_is_shared_between_trip_evaluations():
    lock, full, exceeded, release = Lock(), Event(), Event(), Event()
    active = peak = calls = 0

    def fake(url, params, name):
        nonlocal active, peak, calls
        with lock:
            calls += 1
            active += 1
            peak = max(peak, active)
            if active == 3:
                full.set()
            if active > 3:
                exceeded.set()
        try:
            assert release.wait(5)
            return [hourly_forecast() for _ in params["latitude"].split(",")]
        finally:
            with lock:
                active -= 1

    with patch("routing.providers.common.get_json", side_effect=fake):
        with ThreadPoolExecutor(max_workers=2) as callers:
            futures = [
                callers.submit(weather.forecasts, [[i / 100, lat] for i in range(120)])
                for lat in (20, 21)
            ]
            try:
                assert full.wait(5)
                assert not exceeded.wait(0.1)
            finally:
                release.set()
            for future in futures:
                assert not future.result()[1]
    assert calls == 6
    assert peak == 3


def boundary_route(sign=1, latitude=61):
    coords = [[sign * (154.99 + i * 25 / 200), latitude] for i in range(201)]
    distances = [haversine(a, b) for a, b in zip(coords, coords[1:])]
    return {
        "geometry": coords,
        "edge_distances": distances,
        "edge_durations": [60] * 200,
        "distance_meters": sum(distances),
        "duration_seconds": 12000,
    }


@pytest.mark.parametrize("sign,latitude", [(1, 61), (-1, 61), (1, 84.99), (-1, -84.99)])
def test_coarse_corridor_clips_valid_cells_and_preserves_route_coverage(sign, latitude):
    route = boundary_route(sign, latitude)
    departure = datetime.now(timezone.utc)
    points = [p["coordinate"] for p in sample_route(route, 20, departure)]
    cells = corridor_cells([route], departure)
    assert 0 < len(cells) <= 64
    # Exercise the coarse builder directly even where high-latitude paths use fewer cells.
    for grid in (cells, coarse_corridor(points, 2)):
        for cell in grid:
            (south, west), (north, east) = cell["bounds"]
            lon, lat = cell["coordinate"]
            assert -180 <= west < lon < east <= 180
            assert -85 <= south < lat < north <= 85
        assert all(
            any(
                c["bounds"][0][1] <= lon <= c["bounds"][1][1]
                and c["bounds"][0][0] <= lat <= c["bounds"][1][0]
                for c in grid
            )
            for lon, lat in points
        )


def test_generated_boundary_cells_do_not_poison_checkpoint_weather_batch():
    route = boundary_route()
    departure = datetime.now(timezone.utc)

    def forecast_fixture(coords):
        assert all(-180 <= lon <= 180 and -85 <= lat <= 85 for lon, lat in coords)
        target = departure.replace(minute=0, second=0, microsecond=0)
        from datetime import timedelta

        series = [
            {
                "time": (target + timedelta(hours=i)).isoformat(),
                "wind_mph": 10,
                "rain_in": 0,
                "snow_in": 0,
            }
            for i in range(50)
        ]
        return {weather.location_key(c): series for c in coords}, []

    with (
        patch("routing.service.get_routes", return_value=[route]),
        patch("routing.service.forecasts", side_effect=forecast_fixture),
    ):
        result = build_plan({"name": "start"}, {"name": "end"}, departure, 32000, 10)
    assert result["routes"][0]["summary"]["complete"]
    assert result["recommended_id"] == "r1"


@pytest.mark.parametrize("factor", [1, 2, 3, 5, 10, 2**0.5])
def test_exact_extent_corners_keep_a_valid_representative_cell(factor):
    for lon in (-180, 180):
        for lat in (-85, 85):
            cells = coarse_corridor([[lon, lat]], factor)
            assert len(cells) == 1
            (south, west), (north, east) = cells[0]["bounds"]
            assert -180 <= west <= lon <= east <= 180
            assert -85 <= south <= lat <= north <= 85
            assert west < cells[0]["coordinate"][0] < east
            assert south < cells[0]["coordinate"][1] < north


def test_deeply_nested_upstream_json_is_a_controlled_provider_error(client):
    response = httpx.Response(
        200,
        content="[" * 1500 + "0" + "]" * 1500,
        request=httpx.Request("GET", "https://example.test"),
    )
    with patch("routing.providers.common.httpx.Client.get", return_value=response):
        result = client.get("/api/geocode?q=Town")
    assert result.status_code == 502
    assert result.json()["error"]["code"] == "provider_unavailable"


def test_out_of_horizon_iso_forecast_dates_do_not_require_platform_timestamp_support():
    # Windows cannot convert year 1 to a POSIX timestamp; it is still valid ISO data.
    raw = hourly_forecast()
    raw["hourly"]["time"] = ["0001-01-01T00:00"]
    series = weather.parse_forecast(raw)
    assert weather.weather_at(series, datetime.now(timezone.utc)) is None


def test_arrival_hour_beyond_datetime_horizon_stays_unknown():
    departure = datetime.now(timezone.utc).replace(microsecond=0)
    duration = (datetime(9999, 12, 31, 23, 30, tzinfo=timezone.utc) - departure).total_seconds()
    route = {
        "geometry": [[0, 0], [0.1, 0]],
        "edge_distances": [10000],
        "edge_durations": [duration],
        "distance_meters": 10000,
        "duration_seconds": duration,
    }
    with (
        patch("routing.service.get_routes", return_value=[route]),
        patch("routing.service.forecasts", return_value=({}, [])),
    ):
        result = build_plan({"name": "start"}, {"name": "end"}, departure, 32000, 25)
    assert result["routes"][0]["checkpoints"][-1]["arrival"].startswith("9999-12-31T23:30:")
    assert not result["routes"][0]["summary"]["complete"]
    assert result["recommended_id"] is None
    assert result["warnings"]


def test_forecast_lookup_rounds_after_converting_arrival_to_utc():
    series = [{"time": "2026-10-15T01:00:00+00:00", "wind_mph": 10}]
    assert (
        weather.weather_at(series, datetime.fromisoformat("2026-10-15T06:00:00+05:30")) == series[0]
    )
