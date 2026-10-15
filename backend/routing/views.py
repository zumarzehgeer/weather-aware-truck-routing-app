import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse, FileResponse
from django.views.decorators.http import require_GET, require_POST

from . import providers
from .service import build_plan


def error(message, code='validation_error', status=400):
    return JsonResponse({'error': {'code':code, 'message':message}},status=status)


def throttle(request, kind, limit):
    # REMOTE_ADDR is intentionally used instead of trusting arbitrary forwarded headers.
    identity = request.META.get('REMOTE_ADDR','unknown')
    minute = int(datetime.now(timezone.utc).timestamp()//60)
    name=providers.key('throttle:',[kind,identity,minute])
    cache.add(name,0,90)
    try:
        count=cache.incr(name)
    except ValueError:
        cache.set(name,1,90)
        count=1
    return count > limit


@require_GET
def health(request):
    return JsonResponse({'status':'ok','demo_enabled':settings.ENABLE_DEMO})


@require_GET
def geocode(request):
    query=request.GET.get('q','').strip()
    if not 2<=len(query)<=100:
        return error('Search must contain 2–100 characters.')
    if throttle(request,'geocode',30):
        return error('Too many searches. Please wait a minute.','rate_limit',429)
    try:
        return JsonResponse({'results':providers.geocode(query)})
    except providers.ProviderError as exc:
        return error(str(exc),exc.code,exc.status)


def validate(data):
    if not isinstance(data,dict):
        raise ValueError('A JSON object is required.')
    origin,destination=data.get('origin'),data.get('destination')
    for name,place in [('Origin',origin),('Destination',destination)]:
        if not isinstance(place,dict) or not isinstance(place.get('name'),str) or not 1<=len(place['name'])<=200:
            raise ValueError(f'{name} must be selected from place search.')
        for field,limit in [('latitude',85),('longitude',180)]:
            value=place.get(field)
            if isinstance(value,bool) or not isinstance(value,(int,float)) or not -limit<=value<=limit or not math.isfinite(value):
                raise ValueError(f'{name} has an invalid {field}. Supported latitude is ±85°.')
    if origin['latitude']==destination['latitude'] and origin['longitude']==destination['longitude']:
        raise ValueError('Choose different origin and destination places.')
    load=data.get('load_lb')
    if isinstance(load,bool) or not isinstance(load,(int,float)) or not 0<=load<=120000 or not math.isfinite(load):
        raise ValueError('Load must be between 0 and 120,000 lb.')
    spacing=data.get('spacing_miles')
    if isinstance(spacing,bool) or spacing not in (10,25,50):
        raise ValueError('Checkpoint spacing must be 10, 25, or 50 miles.')
    if not isinstance(data.get('demo',False),bool):
        raise ValueError('Demo must be a boolean.')
    try:
        zone=ZoneInfo(data.get('timezone',''))
        local=datetime.fromisoformat(data.get('departure_local',''))
        if local.tzinfo is not None:
            raise ValueError('Use a local departure time plus an IANA timezone.')
        aware=local.replace(tzinfo=zone,fold=0)
        if aware.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None)!=local:
            raise ValueError('This local departure time does not exist because clocks move forward. Choose another time.')
        if aware.utcoffset()!=local.replace(tzinfo=zone,fold=1).utcoffset():
            raise ValueError('This departure time is repeated when clocks move back. Choose a time outside the repeated hour.')
        departure=aware.astimezone(timezone.utc)
    except (ZoneInfoNotFoundError,TypeError,KeyError,OverflowError) as exc:
        raise ValueError('Provide a valid local departure time and IANA timezone.') from exc
    now=datetime.now(timezone.utc)
    if departure < now-timedelta(minutes=5):
        raise ValueError('Departure must be in the future (a five-minute clock tolerance is allowed).')
    if departure > now+timedelta(days=7):
        raise ValueError('Departure is outside the 7-day forecast request horizon. Choose an earlier departure; arrival forecasts may end sooner.')
    return origin,destination,departure,load,spacing


@require_POST
def plan(request):
    if request.content_type != 'application/json':
        return error('Use application/json.','unsupported_media_type',415)
    try:
        data=json.loads(request.body)
        args=validate(data)
    except (json.JSONDecodeError,ValueError,UnicodeDecodeError,RecursionError) as exc:
        return error(str(exc))
    demo=data.get('demo',False)
    if demo and not settings.ENABLE_DEMO:
        return error('Demo mode is disabled.','demo_disabled',403)
    if throttle(request,'plan',8):
        return error('Too many trip evaluations. Wait a minute before retrying.','rate_limit',429)
    try:
        return JsonResponse(build_plan(*args,demo=demo))
    except providers.ProviderError as exc:
        return error(str(exc),exc.code,exc.status)


@require_GET
def index(request):
    path=Path(settings.BASE_DIR).parent/'frontend/dist/index.html'
    if not path.exists():
        return error('Frontend is not built. Run npm ci and npm run build in frontend, or use the Vite development server.','frontend_not_built',503)
    return FileResponse(path.open('rb'),content_type='text/html')
