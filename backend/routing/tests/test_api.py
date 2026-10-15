import json
from datetime import datetime,timedelta,timezone
from unittest.mock import patch
import httpx
import pytest
from django.core.cache import cache
from routing import providers
from routing.views import validate


@pytest.fixture(autouse=True)
def fresh_cache():
    cache.clear()


def payload():
    return {'origin':{'name':'Chicago','latitude':41.8781,'longitude':-87.6298},
            'destination':{'name':'Detroit','latitude':42.3314,'longitude':-83.0458},
            'departure_local':(datetime.now(timezone.utc)+timedelta(hours=1)).replace(tzinfo=None).isoformat(),
            'timezone':'UTC','load_lb':32000,'spacing_miles':25,'demo':True}


def test_demo_contract_and_distances(client):
    response=client.post('/api/plan',data=json.dumps(payload()),content_type='application/json')
    assert response.status_code==200
    data=response.json()
    assert data['mode']=='demo' and len(data['routes'])==3
    assert len(data['corridor']['timestamps'])==49
    assert all(len(c['forecasts'])==49 for c in data['corridor']['cells'])
    assert not data['providers']['truck_restrictions']
    for r in data['routes']:
        assert sum(r['summary']['risk_miles'].values())==pytest.approx(r['distance_miles'])
        assert r['checkpoints'][-1]['arrival']==r['arrival']
    assert data['recommended_id'] in [r['id'] for r in data['routes'] if r['summary']['complete'] and not r['summary']['no_travel']]


@pytest.mark.parametrize('field,value', [('load_lb',-1),('load_lb',float('nan')),('load_lb',True),('load_lb',120001),
    ('spacing_miles',20),('origin',None),('timezone','not-a-zone'),('departure_local','yesterday'),('demo','yes')])
def test_input_validation(client,field,value):
    data=payload();data[field]=value
    response=client.post('/api/plan',data=json.dumps(data),content_type='application/json')
    assert response.status_code==400
    assert response.json()['error']['code']=='validation_error'


def test_past_and_outside_horizon_departures(client):
    for days in [-1,8]:
        data=payload();data['departure_local']=(datetime.now(timezone.utc)+timedelta(days=days)).replace(tzinfo=None).isoformat()
        assert client.post('/api/plan',data=json.dumps(data),content_type='application/json').status_code==400


def test_dst_invalid_and_ambiguous_local_times():
    data=payload();data['timezone']='America/New_York'
    for local,word in [('2027-03-14T02:30','does not exist'),('2026-11-01T01:30','repeated')]:
        data['departure_local']=local
        with pytest.raises(ValueError,match=word): validate(data)


def test_bad_request_content_and_methods(client):
    assert client.get('/api/plan').status_code==405
    assert client.post('/api/plan',data='{bad',content_type='application/json').status_code==400
    assert client.post('/api/plan',data='[]',content_type='application/json').status_code==400
    assert client.post('/api/plan',data='text',content_type='text/plain').status_code==415
    assert client.get('/api/geocode?q=a').status_code==400


def test_representative_provider_timeout_and_rate_limit(client):
    data=payload();data['demo']=False
    with patch('routing.providers.httpx.Client.get',side_effect=httpx.ReadTimeout('timeout')):
        response=client.post('/api/plan',data=json.dumps(data),content_type='application/json')
    assert response.status_code==502 and response.json()['error']['code']=='provider_unavailable'
    with patch('routing.providers.httpx.Client.get',return_value=httpx.Response(429,request=httpx.Request('GET','https://example.com'))):
        response=client.get('/api/geocode?q=Chicago')
    assert response.status_code==503 and response.json()['error']['code']=='provider_rate_limit'


def test_geocode_results_cached_and_not_fabricated(client):
    with patch('routing.providers.get_json',return_value={'results':[{'name':'Chicago','admin1':'Illinois','country':'US','latitude':41.88,'longitude':-87.63}]}) as mock:
        first=client.get('/api/geocode?q=Chicago').json()
        second=client.get('/api/geocode?q=Chicago').json()
    assert mock.call_count==1 and first==second
    assert first['results'][0]['name']=='Chicago, Illinois, US'


def osrm_route():
    return {'distance':16093.44,'duration':1000,'geometry':{'coordinates':[[-87.63,41.88],[-83.05,42.33]]},
            'legs':[{'annotation':{'distance':[16093.44],'duration':[1000]}}]}


def test_fewer_distinct_routes_and_weather_failure_excluded(client):
    data=payload();data['demo']=False
    def fake(url,params,name):
        if name=='Routing service':
            return {'code':'Ok','routes':[osrm_route(),osrm_route()]}
        raise providers.ProviderError('Weather rate limit reached.','provider_rate_limit',503)
    with patch('routing.providers.get_json',side_effect=fake):
        response=client.post('/api/plan',data=json.dumps(data),content_type='application/json')
    assert response.status_code==200
    result=response.json()
    assert len(result['routes'])==1 and result['recommended_id'] is None
    assert not result['routes'][0]['summary']['complete']
    assert result['routes'][0]['summary']['average_risk'] is None
    assert any('1 distinct route' in warning for warning in result['warnings'])


def test_parse_units_nulls_and_forecast_cache():
    raw={'hourly_units':{'wind_speed_10m':'km/h','rain':'mm','showers':'mm','snowfall':'cm'},
         'hourly':{'time':[1767225600,1767229200],'wind_speed_10m':[40.2336,None],'rain':[25.4,0],'showers':[0,0],'snowfall':[2.54,0]}}
    parsed=providers.parse_forecast(raw)
    assert parsed[0]['wind_mph']==pytest.approx(25)
    assert parsed[0]['snow_in']==1 and parsed[0]['rain_in']==1
    assert parsed[1]['wind_mph'] is None
    with patch('routing.providers.get_json',return_value=raw) as mock:
        first,_=providers.forecasts([[-87.6,41.8]])
        second,_=providers.forecasts([[-87.6,41.8]])
    assert first==second and mock.call_count==1


def test_malformed_route_and_no_route(client):
    for raw,expected in [({'code':'NoRoute'},422),({'code':'Ok','routes':[{}]},502)]:
        with patch('routing.providers.get_json',return_value=raw):
            data=payload();data['demo']=False
            response=client.post('/api/plan',data=json.dumps(data),content_type='application/json')
        assert response.status_code==expected


def test_request_throttle_and_disabled_demo(client,settings):
    settings.ENABLE_DEMO=False
    assert client.post('/api/plan',data=json.dumps(payload()),content_type='application/json').status_code==403
    settings.ENABLE_DEMO=True
    with patch('routing.views.build_plan',return_value={'routes':[]}):
        for _ in range(8):
            assert client.post('/api/plan',data=json.dumps(payload()),content_type='application/json').status_code==200
        assert client.post('/api/plan',data=json.dumps(payload()),content_type='application/json').status_code==429


def test_weather_budget_counts_locations_not_http_batches():
    providers.reserve_weather_budget(500)
    with pytest.raises(providers.ProviderError,match='budget reached'):
        providers.reserve_weather_budget(1)


def test_rain_combines_showers_and_large_scale_precipitation():
    raw={'hourly_units':{'wind_speed_10m':'mp/h','rain':'inch','showers':'inch','snowfall':'cm'},
         'hourly':{'time':[1767225600],'wind_speed_10m':[10],'rain':[.1],'showers':[.15],'snowfall':[0]}}
    assert providers.parse_forecast(raw)[0]['rain_in']==.25
    raw['hourly']['showers']=[None]
    assert providers.parse_forecast(raw)[0]['rain_in'] is None
