"""Explicit demo or live readiness check; never silently substitutes demo data."""

import argparse
import json
import re
import urllib.request
from urllib.parse import urlencode
from datetime import datetime, timedelta, timezone


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--live", action="store_true")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    def fetch_url(url, data=None):
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode() if data else None,
            headers={"Content-Type": "application/json"} if data else {},
        )
        with urllib.request.urlopen(req, timeout=120) as response:
            return response.read()

    def fetch(path, data=None):
        return fetch_url(base + path, data)

    health = json.loads(fetch("/api/health"))
    assert health["status"] == "ok"
    html = fetch("/").decode()
    assets = re.findall(r'(?:src|href)="(/assets/[^\"]+)"', html)
    assert assets and all(len(fetch(asset)) > 100 for asset in assets)
    origin = {"name": "Chicago", "latitude": 41.8781, "longitude": -87.6298}
    destination = {"name": "Detroit", "latitude": 42.3314, "longitude": -83.0458}
    if args.live:
        places = json.loads(fetch("/api/geocode?q=Chicago"))["results"]
        assert places, "Live geocoding returned no results"
        origin = places[0]
        places = json.loads(fetch("/api/geocode?q=Detroit"))["results"]
        assert places, "Live geocoding returned no results"
        destination = places[0]
    data = {
        "origin": origin,
        "destination": destination,
        "timezone": "UTC",
        "departure_local": (datetime.now(timezone.utc) + timedelta(hours=1))
        .replace(tzinfo=None)
        .isoformat(),
        "load_lb": 32000,
        "spacing_miles": 25,
        "demo": not args.live,
    }
    if args.live and health.get("weather_transport") == "browser":
        prepared = json.loads(fetch("/api/plan/prepare", data))
        batches = []
        for offset in range(0, len(prepared["locations"]), 40):
            coords = prepared["locations"][offset : offset + 40]
            params = urlencode(
                {
                    "latitude": ",".join(str(c[1]) for c in coords),
                    "longitude": ",".join(str(c[0]) for c in coords),
                    "hourly": "wind_speed_10m,rain,showers,snowfall",
                    "wind_speed_unit": "mph",
                    "precipitation_unit": "inch",
                    "timezone": "GMT",
                    "timeformat": "unixtime",
                    "forecast_days": 7,
                }
            )
            batches.append(
                json.loads(fetch_url("https://api.open-meteo.com/v1/forecast?" + params))
            )
        result = json.loads(
            fetch(
                "/api/plan/complete",
                {"token": prepared["token"], "weather_batches": batches},
            )
        )
    else:
        result = json.loads(fetch("/api/plan", data))
    assert result["mode"] == ("live" if args.live else "demo")
    assert 1 <= len(result["routes"]) <= 3
    assert len(result["corridor"]["timestamps"]) == 49 and result["corridor"]["cells"]
    assert all(len(c["forecasts"]) == 49 for c in result["corridor"]["cells"])
    assert all(
        r["summary"]["complete"] for r in result["routes"]
    ), "Arrival-time forecasts incomplete; live readiness unverified"
    print(
        f"PASS: health, frontend assets, {result['mode']} plan, {len(result['routes'])} routes, complete arrival forecasts, 49 corridor frames"
    )
    print(f"Recommendation: {result['recommended_id'] or 'none (conditions prohibit travel)'}")


if __name__ == "__main__":
    main()
