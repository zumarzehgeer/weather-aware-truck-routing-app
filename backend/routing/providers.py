"""Bounded, cached calls to real public providers. Failures never become calm weather."""
import hashlib
import json
import math
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import httpx
from django.conf import settings
from django.core.cache import cache


class ProviderError(Exception):
    def __init__(self, message, code='provider_unavailable', status=502):
        super().__init__(message)
        self.code, self.status = code, status


def key(prefix, data):
    return prefix+hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def get_json(url, params, name):
    try:
        with httpx.Client(timeout=httpx.Timeout(25, connect=8), headers={'User-Agent': settings.PROVIDER_USER_AGENT}) as client:
            response = client.get(url, params=params)
            if response.status_code == 429:
                raise ProviderError(f'{name} rate limit reached. Wait before retrying.', 'provider_rate_limit', 503)
            response.raise_for_status()
            return response.json()
    except ProviderError:
        raise
    except (httpx.HTTPError, ValueError) as exc:
        raise ProviderError(f'{name} is unavailable. Check provider access and try again. No substitute data was used.') from exc


def geocode(query):
    cache_key = key('geo:', query.casefold())
    if (result := cache.get(cache_key)) is not None:
        return result
    data = get_json(settings.GEOCODING_BASE_URL+'/v1/search', {'name': query, 'count': 6, 'language': 'en', 'format': 'json'}, 'Place search')
    try:
        if not isinstance(data, dict):
            raise ValueError('Expected object')
        result = [{'name': ', '.join(dict.fromkeys(str(p[k]) for k in ('name','admin1','country') if p.get(k))),
                   'latitude': float(p['latitude']), 'longitude': float(p['longitude']), 'timezone': p.get('timezone','UTC')}
                  for p in data.get('results', [])]
    except (KeyError, TypeError, ValueError) as exc:
        raise ProviderError('Place search returned malformed data.') from exc
    cache.set(cache_key, result, 86400)
    return result


_routing_lock = threading.Lock()
_routing_last = 0.0
_weather_budget_lock = threading.Lock()


def reserve_weather_budget(locations):
    """Single-worker assessment budget, counted by locations even when batched."""
    epoch = int(time.time())
    limits = [(60, 500), (3600, 4500), (86400, 9000)]
    with _weather_budget_lock:
        entries = [(f'weather-budget:{period}:{epoch//period}', limit, period) for period, limit in limits]
        if any(cache.get(name,0)+locations > limit for name,limit,period in entries):
            raise ProviderError('Weather request budget reached. Reuse a cached trip or retry later; unavailable data remains unknown.', 'provider_rate_limit', 503)
        for name,limit,period in entries:
            cache.set(name,cache.get(name,0)+locations,period+60)


def get_routes(origin, destination):
    global _routing_last
    coordinates = f"{origin['longitude']},{origin['latitude']};{destination['longitude']},{destination['latitude']}"
    cache_key = key('route:', coordinates)
    with _routing_lock:
        if (result := cache.get(cache_key)) is not None:
            return result
        # Respect the public demonstration server's 1 request/second guidance per worker.
        delay = 1-(time.monotonic()-_routing_last)
        if delay > 0:
            time.sleep(delay)
        _routing_last = time.monotonic()
        data = get_json(settings.OSRM_BASE_URL+'/route/v1/driving/'+coordinates,
                        {'alternatives': 3, 'steps': 'false', 'annotations': 'distance,duration',
                         'overview': 'full', 'geometries': 'geojson'}, 'Routing service')
    if not isinstance(data,dict):
        raise ProviderError('Routing service returned malformed data.')
    if data.get('code') in ('NoRoute','NoSegment'):
        raise ProviderError('No drivable route was found between these places.', 'no_route', 422)
    if data.get('code') != 'Ok':
        raise ProviderError('Routing service could not calculate this trip.')
    routes, seen = [], set()
    try:
        for raw in data['routes']:
            coords = raw['geometry']['coordinates']
            signature = json.dumps(coords)
            if signature in seen:
                continue
            seen.add(signature)
            legs = raw['legs']
            distances = [float(x) for leg in legs for x in leg['annotation']['distance']]
            durations = [float(x) for leg in legs for x in leg['annotation']['duration']]
            if len(coords)-1 != len(distances) or len(distances) != len(durations):
                raise ValueError('Edge annotation mismatch')
            route = {'geometry': coords, 'edge_distances': distances, 'edge_durations': durations,
                     'distance_meters': float(raw['distance']), 'duration_seconds': float(raw['duration'])}
            if not all(math.isfinite(route[k]) and route[k] > 0 for k in ('distance_meters','duration_seconds')):
                raise ValueError('Invalid route totals')
            if any(len(c)!=2 or not all(isinstance(x,(int,float)) and math.isfinite(x) for x in c) for c in coords):
                raise ValueError('Invalid geometry')
            routes.append(route)
            if len(routes) == 3:
                break
        if not routes:
            raise ValueError('No routes')
    except (KeyError, TypeError, ValueError) as exc:
        raise ProviderError('Routing service returned incomplete geometry or timing annotations.') from exc
    cache.set(cache_key, routes, 86400)
    return routes


def convert(value, unit, kind):
    if not isinstance(value, (int,float)) or isinstance(value, bool) or not math.isfinite(value) or value < 0:
        return None
    factors = {'wind': {'mp/h': 1, 'mph': 1, 'km/h': 1/1.609344, 'm/s': 2.2369362921, 'kn': 1.150779448},
               'precip': {'inch': 1, 'in': 1, 'mm': 1/25.4, 'cm': 1/2.54}}
    factor = factors[kind].get(unit)
    # Eliminate binary conversion dust at exact assessment boundaries (e.g. 6.35 mm = .25 in).
    return round(value*factor, 10) if factor is not None else None


def parse_forecast(data):
    hourly, units = data['hourly'], data['hourly_units']
    times = hourly['time']
    fields = ['wind_speed_10m', 'rain', 'showers', 'snowfall']
    if any(len(hourly[f]) != len(times) for f in fields):
        raise ValueError('Mismatched hourly arrays')
    result = []
    for i, timestamp in enumerate(times):
        dt = datetime.fromtimestamp(timestamp, timezone.utc) if isinstance(timestamp, (int,float)) else datetime.fromisoformat(timestamp).replace(tzinfo=timezone.utc)
        rain = convert(hourly['rain'][i], units.get('rain'), 'precip')
        showers = convert(hourly['showers'][i], units.get('showers'), 'precip')
        result.append({'time': dt.isoformat(), 'wind_mph': convert(hourly['wind_speed_10m'][i], units.get('wind_speed_10m'), 'wind'),
                       'rain_in': round(rain+showers,10) if rain is not None and showers is not None else None,
                       'snow_in': convert(hourly['snowfall'][i], units.get('snowfall'), 'precip')})
    return result


def location_key(coordinate):
    return tuple(round(x,3) for x in coordinate)


def forecasts(coordinates):
    coordinates = list(dict.fromkeys(location_key(c) for c in coordinates))
    result, pending, warnings = {}, [], []
    for c in coordinates:
        stored = cache.get(key('weather:', c))
        if stored is not None:
            result[c] = stored
        else:
            pending.append(c)

    def batch(coords):
        try:
            reserve_weather_budget(len(coords))
            raw = get_json(settings.WEATHER_BASE_URL+'/v1/forecast', {
                'latitude': ','.join(str(c[1]) for c in coords), 'longitude': ','.join(str(c[0]) for c in coords),
                'hourly': 'wind_speed_10m,rain,showers,snowfall', 'wind_speed_unit': 'mph', 'precipitation_unit': 'inch',
                'timezone': 'GMT', 'timeformat': 'unixtime', 'forecast_days': 7}, 'Weather service')
            data = raw if isinstance(raw,list) else [raw]
            if len(data) != len(coords):
                raise ValueError('Wrong location count')
            parsed = [parse_forecast(d) for d in data]
            for c, value in zip(coords, parsed):
                cache.set(key('weather:', c), value, 1800)
            return dict(zip(coords, parsed)), None
        except (ProviderError, KeyError, TypeError, ValueError, OverflowError) as exc:
            return {c: [] for c in coords}, str(exc) if isinstance(exc,ProviderError) else 'Weather service returned incomplete or invalid forecast data.'

    batches = [pending[i:i+40] for i in range(0,len(pending),40)]
    with ThreadPoolExecutor(max_workers=3) as pool:
        for values, warning in pool.map(batch, batches):
            result.update(values)
            if warning:
                warnings.append(warning)
    return result, list(dict.fromkeys(warnings))


def weather_at(series, arrival):
    """Forecast labelled H represents the preceding hour's precipitation; choose ceil(ETA)."""
    timestamp = arrival.timestamp()
    target = math.ceil(timestamp/3600)*3600
    for item in series:
        if datetime.fromisoformat(item['time']).timestamp() == target:
            return item
    return None
