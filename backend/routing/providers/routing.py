"""OSRM driving alternatives, validated edge timings and serialized public requests."""

import json
import math
import threading
import time

from django.conf import settings
from django.core.cache import cache

from . import common

_routing_lock = threading.Lock()
_routing_last = 0.0


def get_routes(origin, destination):
    """Return up to three distinct paths with validated per-edge distance and duration."""
    global _routing_last
    coordinates = f"{origin['longitude']},{origin['latitude']};{destination['longitude']},{destination['latitude']}"
    cache_key = common.key("route:", coordinates)
    with _routing_lock:
        if (result := cache.get(cache_key)) is not None:
            return result
        # Respect the public demonstration server's 1 request/second guidance per worker.
        delay = 1 - (time.monotonic() - _routing_last)
        if delay > 0:
            time.sleep(delay)
        _routing_last = time.monotonic()
        data = common.get_json(
            settings.OSRM_BASE_URL + "/route/v1/driving/" + coordinates,
            {
                "alternatives": 3,
                "steps": "false",
                "annotations": "distance,duration",
                "overview": "full",
                "geometries": "geojson",
            },
            "Routing service",
            routing_errors=True,
        )
    if not isinstance(data, dict):
        raise common.ProviderError("Routing service returned malformed data.")
    if data.get("code") in ("NoRoute", "NoSegment"):
        raise common.ProviderError(
            "No drivable route was found between these places.", "no_route", 422
        )
    if data.get("code") != "Ok":
        raise common.ProviderError("Routing service could not calculate this trip.")
    routes, seen = [], set()
    try:
        if not isinstance(data.get("routes"), list):
            raise ValueError("Expected routes array")
        for raw in data["routes"]:
            if not isinstance(raw, dict) or not isinstance(raw.get("geometry"), dict):
                raise ValueError("Expected route geometry")
            coords = raw["geometry"]["coordinates"]
            if not isinstance(coords, list) or len(coords) < 2:
                raise ValueError("Expected coordinate array")
            for coordinate in coords:
                if not isinstance(coordinate, list) or len(coordinate) != 2:
                    raise ValueError("Invalid geometry coordinate")
                common.finite_number(coordinate[0], -180, 180)
                common.finite_number(coordinate[1], -85, 85)
            signature = json.dumps(coords)
            if signature in seen:
                continue
            seen.add(signature)
            legs = raw["legs"]
            if not isinstance(legs, list) or not legs:
                raise ValueError("Expected routing legs")
            distances, durations = [], []
            for leg in legs:
                if not isinstance(leg, dict) or not isinstance(leg.get("annotation"), dict):
                    raise ValueError("Expected edge annotations")
                annotation = leg["annotation"]
                if not isinstance(annotation.get("distance"), list) or not isinstance(
                    annotation.get("duration"), list
                ):
                    raise ValueError("Expected edge arrays")
                distances.extend(common.finite_number(x, 0) for x in annotation["distance"])
                durations.extend(common.finite_number(x, 0) for x in annotation["duration"])
            if len(coords) - 1 != len(distances) or len(distances) != len(durations):
                raise ValueError("Edge annotation mismatch")
            route = {
                "geometry": coords,
                "edge_distances": distances,
                "edge_durations": durations,
                "distance_meters": common.finite_number(raw["distance"], 0),
                "duration_seconds": common.finite_number(raw["duration"], 0),
            }
            if not all(
                math.isfinite(route[k]) and route[k] > 0
                for k in ("distance_meters", "duration_seconds")
            ):
                raise ValueError("Invalid route totals")
            routes.append(route)
            if len(routes) == 3:
                break
        if not routes:
            raise ValueError("No routes")
    except (KeyError, TypeError, ValueError) as exc:
        raise common.ProviderError(
            "Routing service returned incomplete geometry or timing annotations."
        ) from exc
    cache.set(cache_key, routes, 86400)
    return routes
