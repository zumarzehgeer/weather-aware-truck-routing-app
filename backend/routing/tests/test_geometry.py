from datetime import datetime,timezone
import pytest
from routing.geometry import sample_route, METERS_PER_MILE, corridor_cells
from routing.providers import weather_at
from routing.demo import demo_routes

DEPARTURE=datetime(2026,1,1,tzinfo=timezone.utc)


def test_exact_sampling_uses_edge_durations_not_whole_route_speed():
    route={'geometry':[[0,0],[1,0],[2,0]],'edge_distances':[10*METERS_PER_MILE,20*METERS_PER_MILE],
           'edge_durations':[3600,1800],'distance_meters':30*METERS_PER_MILE,'duration_seconds':5400}
    points=sample_route(route,10,DEPARTURE)
    assert [p['mile'] for p in points]==pytest.approx([0,10,20,30])
    assert [p['elapsed_seconds'] for p in points]==pytest.approx([0,3600,4500,5400])
    assert points[2]['coordinate']==[1.5,0]
    assert points[-1]['arrival']=='2026-01-01T01:30:00+00:00'


def test_short_route_includes_both_endpoints_and_remainder():
    route=demo_routes()[0]
    points=sample_route(route,1000,DEPARTURE)
    assert len(points)==2
    assert points[0]['mile']==0
    assert points[-1]['mile']==pytest.approx(route['distance_meters']/METERS_PER_MILE)
    assert points[-1]['elapsed_seconds']==pytest.approx(route['duration_seconds'])


def test_zero_distance_edge_and_bad_annotations():
    route={'geometry':[[0,0],[0,0],[1,0]],'edge_distances':[0,100], 'edge_durations':[10,90], 'distance_meters':100,'duration_seconds':100}
    points=sample_route(route,10,DEPARTURE)
    assert points[0]['elapsed_seconds']==0
    assert points[-1]['elapsed_seconds']==100
    route['edge_durations']=[]
    with pytest.raises(ValueError): sample_route(route,10,DEPARTURE)


def test_hourly_lookup_ceil_and_horizon_no_nearest_fallback():
    series=[{'time':'2026-01-01T01:00:00+00:00','wind_mph':10}]
    assert weather_at(series,datetime(2026,1,1,0,30,tzinfo=timezone.utc))==series[0]
    assert weather_at(series,datetime(2026,1,1,1,tzinfo=timezone.utc))==series[0]
    assert weather_at(series,datetime(2026,1,1,1,1,tzinfo=timezone.utc)) is None


def test_corridor_has_multiple_lateral_grid_cells_and_valid_bounds():
    cells=corridor_cells(demo_routes(),DEPARTURE)
    assert 5<len(cells)<=64
    assert len({round(c['coordinate'][1],2) for c in cells})>=2
    for c in cells:
        assert c['bounds'][0][0]<c['coordinate'][1]<c['bounds'][1][0]
        assert c['bounds'][0][1]<c['coordinate'][0]<c['bounds'][1][1]
