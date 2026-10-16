"""Fresh trip payloads and minimal OSRM responses shared by regression tests."""

from datetime import datetime, timedelta, timezone


def trip_payload():
    return {
        "origin": {"name": "Chicago", "latitude": 41.8781, "longitude": -87.6298},
        "destination": {"name": "Detroit", "latitude": 42.3314, "longitude": -83.0458},
        "departure_local": (datetime.now(timezone.utc) + timedelta(hours=1))
        .replace(tzinfo=None)
        .isoformat(),
        "timezone": "UTC",
        "load_lb": 32000,
        "spacing_miles": 25,
        "demo": True,
    }


def osrm_route():
    return {
        "distance": 16093.44,
        "duration": 1000,
        "geometry": {"coordinates": [[-87.63, 41.88], [-83.05, 42.33]]},
        "legs": [{"annotation": {"distance": [16093.44], "duration": [1000]}}],
    }
