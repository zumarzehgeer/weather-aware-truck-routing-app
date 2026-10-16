"""Build a trip plan from routes, sampled arrival forecasts and the supplied risk model."""

from datetime import datetime, timedelta, timezone

from .geometry import sample_route, corridor_cells, METERS_PER_MILE
from .providers.common import ProviderError
from .providers.routing import get_routes
from .providers.weather import forecasts, location_key, weather_at
from .risk import classify, aggregate, recommend


def build_plan(origin, destination, departure, load, spacing, demo=False):
    now = datetime.now(timezone.utc)
    if demo:
        from .demo import demo_routes, demo_forecasts

        raw_routes = demo_routes()
        origin = {
            "name": "Chicago, Illinois, United States",
            "latitude": 41.8781,
            "longitude": -87.6298,
        }
        destination = {
            "name": "Detroit, Michigan, United States",
            "latitude": 42.3314,
            "longitude": -83.0458,
        }
    else:
        raw_routes = get_routes(origin, destination)
    if any(r["distance_meters"] > 1600 * METERS_PER_MILE for r in raw_routes):
        raise ProviderError(
            "This assessment supports trips up to 1,600 miles per alternative. Choose a closer destination.",
            "trip_too_long",
            422,
        )
    try:
        sampled = [sample_route(r, spacing, departure) for r in raw_routes]
        cells = corridor_cells(raw_routes, departure)
    except (ValueError, OverflowError) as exc:
        raise ProviderError("Routing service returned invalid edge timing or geometry.") from exc
    locations = [p["coordinate"] for route in sampled for p in route] + [
        c["coordinate"] for c in cells
    ]
    if len({location_key(c) for c in locations}) > 220:
        raise ProviderError(
            "This trip needs too many forecast locations. Select wider checkpoint spacing or a shorter trip (maximum 220 locations).",
            "forecast_budget",
            422,
        )
    series, warnings = (demo_forecasts(locations, now), []) if demo else forecasts(locations)
    routes = []
    for index, (raw, checkpoints) in enumerate(zip(raw_routes, sampled)):
        for n, point in enumerate(checkpoints):
            weather = weather_at(
                series.get(location_key(point["coordinate"]), []),
                datetime.fromisoformat(point["arrival"]),
            )
            point.update(
                {"id": f"r{index+1}-p{n}", "weather": weather, "risk": classify(weather, load)}
            )
        routes.append(
            {
                "id": f"r{index+1}",
                "name": ["Route A", "Route B", "Route C"][index],
                "geometry": raw["geometry"],
                "distance_miles": raw["distance_meters"] / METERS_PER_MILE,
                "duration_seconds": raw["duration_seconds"],
                "arrival": checkpoints[-1]["arrival"],
                "checkpoints": checkpoints,
                "summary": aggregate(checkpoints),
            }
        )
    snapshot_start = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    timestamps = [(snapshot_start + timedelta(hours=h)).isoformat() for h in range(49)]
    for cell in cells:
        cell["forecasts"] = []
        values = series.get(location_key(cell["coordinate"]), [])
        for timestamp in timestamps:
            weather = weather_at(values, datetime.fromisoformat(timestamp))
            cell["forecasts"].append({"weather": weather, "risk": classify(weather, load)})
    recommended, explanation = recommend(routes)
    if len(routes) < 3:
        warnings.append(
            f"The routing provider returned {len(routes)} distinct route"
            + ("s" if len(routes) > 1 else "")
            + ". Three were requested; no alternatives have been fabricated."
        )
    if any(not r["summary"]["complete"] for r in routes):
        warnings.append(
            "Some arrival-time forecasts are unavailable, incomplete, or outside the returned 7-day forecast horizon. These routes cannot be recommended."
        )
    return {
        "mode": "demo" if demo else "live",
        "generated_at": now.isoformat(),
        "departure": departure.isoformat(),
        "origin": origin,
        "destination": destination,
        "load_lb": load,
        "spacing_miles": spacing,
        "routes": routes,
        "recommended_id": recommended,
        "explanation": explanation,
        "warnings": warnings,
        "corridor": {"timestamps": timestamps, "cells": cells},
        "providers": {
            "routing": "Synthetic fixture" if demo else "OSRM public driving",
            "weather": "Synthetic fixture" if demo else "Open-Meteo",
            "truck_restrictions": False,
        },
    }
