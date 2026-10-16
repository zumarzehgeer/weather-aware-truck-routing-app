"""Cached city/town search through Open-Meteo geocoding."""

from django.conf import settings
from django.core.cache import cache

from . import common


def geocode(query):
    """Return supported named places, preserving missing/invalid provider responses as errors."""
    cache_key = common.key("geo:", query.casefold())
    if (result := cache.get(cache_key)) is not None:
        return result
    data = common.get_json(
        settings.GEOCODING_BASE_URL + "/v1/search",
        {"name": query, "count": 6, "language": "en", "format": "json"},
        "Place search",
    )
    try:
        if not isinstance(data, dict):
            raise ValueError("Expected object")
        places = data.get("results", [])
        if not isinstance(places, list):
            raise ValueError("Expected results array")
        result = []
        for place in places:
            if (
                not isinstance(place, dict)
                or not isinstance(place.get("name"), str)
                or not place["name"].strip()
            ):
                raise ValueError("Expected named place object")
            if any(
                k in place and not isinstance(place[k], str)
                for k in ("admin1", "country", "timezone")
            ):
                raise ValueError("Invalid place description")
            latitude = common.finite_number(place["latitude"], -90, 90)
            longitude = common.finite_number(place["longitude"], -180, 180)
            # Places outside the map extent cannot be submitted as trip endpoints.
            if abs(latitude) > 85:
                continue
            result.append(
                {
                    "name": ", ".join(
                        dict.fromkeys(
                            place[k] for k in ("name", "admin1", "country") if place.get(k)
                        )
                    ),
                    "latitude": latitude,
                    "longitude": longitude,
                    "timezone": place.get("timezone", "UTC"),
                }
            )
    except (KeyError, TypeError, ValueError) as exc:
        raise common.ProviderError("Place search returned malformed data.") from exc
    cache.set(cache_key, result, 86400)
    return result
