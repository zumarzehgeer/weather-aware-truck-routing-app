"""Browser transport preserves server-owned routes, bounded input and unknown-data rules."""

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from django.core.cache import cache

from .factories import osrm_route, trip_payload


@pytest.fixture(autouse=True)
def browser_transport(settings):
    settings.WEATHER_TRANSPORT = "browser"


def prepared_trip(client):
    payload = trip_payload()
    payload["demo"] = False
    raw = osrm_route()
    route = {
        "geometry": raw["geometry"]["coordinates"],
        "distance_meters": raw["distance"],
        "duration_seconds": raw["duration"],
        "edge_distances": raw["legs"][0]["annotation"]["distance"],
        "edge_durations": raw["legs"][0]["annotation"]["duration"],
    }
    with patch("routing.service.get_routes", return_value=[route]):
        response = client.post(
            "/api/plan/prepare", data=json.dumps(payload), content_type="application/json"
        )
    assert response.status_code == 200
    return response.json()


def forecast():
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return {
        "hourly_units": {
            "wind_speed_10m": "mph",
            "rain": "inch",
            "showers": "inch",
            "snowfall": "inch",
        },
        "hourly": {
            "time": [int((start + timedelta(hours=h)).timestamp()) for h in range(168)],
            "wind_speed_10m": [10] * 168,
            "rain": [0] * 168,
            "showers": [0] * 168,
            "snowfall": [0] * 168,
        },
    }


def batches(prepared):
    return [
        [forecast() for _ in prepared["locations"][i : i + 40]]
        for i in range(0, len(prepared["locations"]), 40)
    ]


def finish(client, prepared, weather_batches):
    return client.post(
        "/api/plan/complete",
        data=json.dumps(
            {
                "token": prepared["token"],
                "weather_batches": weather_batches,
                "origin": {"name": "Client cannot replace route"},
                "load_lb": 0,
            }
        ),
        content_type="application/json",
    )


def test_browser_plan_keeps_server_route_and_evaluation_inputs(client):
    with patch("routing.providers.common.get_json") as server_weather:
        prepared = prepared_trip(client)
        response = finish(client, prepared, batches(prepared))
    server_weather.assert_not_called()
    assert len(prepared["token"]) == 43 and len(prepared["locations"]) <= 220
    data = response.json()
    assert response.status_code == 200 and data["mode"] == "live"
    assert data["origin"]["name"] == "Chicago" and data["load_lb"] == 32000
    assert data["providers"]["weather_transport"] == "browser"
    assert data["routes"][0]["summary"]["complete"] and data["recommended_id"] == "r1"
    assert len(data["corridor"]["timestamps"]) == 49


def test_prepared_token_is_single_use_and_expires(client):
    prepared = prepared_trip(client)
    assert finish(client, prepared, batches(prepared)).status_code == 200
    assert finish(client, prepared, batches(prepared)).status_code == 409
    prepared = prepared_trip(client)
    cache.clear()
    assert finish(client, prepared, batches(prepared)).status_code == 409


@pytest.mark.parametrize(
    "bad", [None, {}, {"hourly": {"time": [0] * 193}}, {"hourly": {"time": [True]}}]
)
def test_failed_or_malformed_weather_stays_unknown(client, bad):
    prepared = prepared_trip(client)
    raw = [
        [bad for _ in prepared["locations"][i : i + 40]]
        for i in range(0, len(prepared["locations"]), 40)
    ]
    response = finish(client, prepared, raw)
    assert response.status_code == 200
    data = response.json()
    assert data["recommended_id"] is None and data["warnings"]
    assert not data["routes"][0]["summary"]["complete"]
    assert data["routes"][0]["summary"]["average_risk"] is None


def test_wrong_batch_count_cannot_consume_prepared_token(client):
    prepared = prepared_trip(client)
    assert finish(client, prepared, []).status_code == 400
    assert finish(client, prepared, batches(prepared)).status_code == 200


def test_browser_endpoints_reject_disabled_transport_and_non_json(client, settings):
    for endpoint in ("prepare", "complete"):
        assert client.get(f"/api/plan/{endpoint}").status_code == 405
        assert (
            client.post(f"/api/plan/{endpoint}", data="{}", content_type="text/plain").status_code
            == 415
        )
    settings.WEATHER_TRANSPORT = "server"
    assert (
        client.post("/api/plan/prepare", data="{}", content_type="application/json").status_code
        == 403
    )
    assert (
        client.post("/api/plan/complete", data="{}", content_type="application/json").status_code
        == 403
    )


def test_large_plan_inputs_remain_limited_to_16_kib(client):
    for endpoint in ("/api/plan", "/api/plan/prepare"):
        response = client.post(
            endpoint, data=json.dumps({"padding": "x" * 16384}), content_type="application/json"
        )
        assert response.status_code == 400 and "too large" in response.json()["error"]["message"]
