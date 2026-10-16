"""Deliberately synthetic Chicago–Detroit fixtures. Never used as a live fallback."""

import math
from datetime import timedelta
from .geometry import haversine
from .providers.weather import location_key


def demo_routes():
    paths = [
        [
            [-87.6298, 41.8781],
            [-87.56, 41.68],
            [-87.3, 41.59],
            [-86.9, 41.6],
            [-86.4, 41.7],
            [-86.05, 41.7],
            [-85.6, 41.75],
            [-85.05, 41.8],
            [-84.5, 41.9],
            [-84.05, 42.12],
            [-83.65, 42.24],
            [-83.1, 42.31],
            [-83.0458, 42.3314],
        ],
        [
            [-87.6298, 41.8781],
            [-87.4, 41.65],
            [-87.05, 41.62],
            [-86.6, 41.85],
            [-86.4, 42.1],
            [-85.9, 42.23],
            [-85.58, 42.29],
            [-85.1, 42.27],
            [-84.6, 42.3],
            [-84.0, 42.28],
            [-83.5, 42.3],
            [-83.0458, 42.3314],
        ],
        [
            [-87.6298, 41.8781],
            [-87.4, 41.6],
            [-86.9, 41.5],
            [-86.25, 41.4],
            [-85.7, 41.35],
            [-85.15, 41.35],
            [-84.7, 41.45],
            [-84.25, 41.58],
            [-83.65, 41.66],
            [-83.45, 41.95],
            [-83.2, 42.2],
            [-83.0458, 42.3314],
        ],
    ]
    routes = []
    for i, path in enumerate(paths):
        distances = [haversine(a, b) * 1.12 for a, b in zip(path, path[1:])]
        durations = [
            d / (24 if i == 0 else 22) * (1.5 if j == 0 else 1) for j, d in enumerate(distances)
        ]
        routes.append(
            {
                "geometry": path,
                "edge_distances": distances,
                "edge_durations": durations,
                "distance_meters": sum(distances),
                "duration_seconds": sum(durations),
            }
        )
    return routes


def demo_forecasts(locations, now):
    result = {}
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    for coord in locations:
        lon, lat = coord
        rows = []
        for h in range(8 * 24):
            phase = h - now.hour
            storm = max(0, 1 - abs(lon - (-85.5 + 0.025 * phase)) / 1.6)
            band = max(0, 1 - abs(lat - 42.15) / 0.7)
            wind = 12 + storm * band * 45 + 3 * math.sin(h / 5 + lon)
            rows.append(
                {
                    "time": (start + timedelta(hours=h)).isoformat(),
                    "wind_mph": max(0, wind),
                    "rain_in": max(0, storm * band * 0.3 * (0.7 + 0.3 * math.sin(h / 4))),
                    "snow_in": 0.0,
                }
            )
        result[location_key(coord)] = rows
    return result
