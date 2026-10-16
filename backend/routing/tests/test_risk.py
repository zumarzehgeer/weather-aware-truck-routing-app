import pytest
from routing.risk import classify, wind_risk, precipitation_risk, aggregate, recommend
from routing.providers.weather import convert


@pytest.mark.parametrize(
    "wind,load,expected",
    [
        (0, 0, 0),
        (24.999, 50000, 0),
        (25, 0, 1),
        (34.999, 50000, 1),
        (35, 40000, 2),
        (35, 40000.01, 3),
        (44.999, 40000, 2),
        (44.999, 40001, 3),
        (45, 30000, 3),
        (45, 30000.01, 4),
        (54.999, 0, 3),
        (55, 0, 4),
        (55, 120000, 4),
    ],
)
def test_continuous_wind_load_boundaries(wind, load, expected):
    assert wind_risk(wind, load) == expected


@pytest.mark.parametrize(
    "kind,values",
    [
        (
            "rain",
            [
                (0.09999, 0),
                (0.1, 1),
                (0.24999, 1),
                (0.25, 2),
                (0.49999, 2),
                (0.5, 3),
                (1, 3),
                (1.00001, 4),
            ],
        ),
        (
            "snow",
            [
                (0.49999, 0),
                (0.5, 1),
                (0.99999, 1),
                (1, 2),
                (1.99999, 2),
                (2, 3),
                (3, 3),
                (3.00001, 4),
            ],
        ),
    ],
)
def test_conservative_precipitation_boundaries(kind, values):
    for amount, expected in values:
        assert precipitation_risk(amount, kind) == expected


@pytest.mark.parametrize(
    "field,unit,amount,expected",
    [
        ("wind", "km/h", 40.2336, 25),
        ("wind", "m/s", 10, 22.369362921),
        ("wind", "mph", 55, 55),
        ("wind", "kn", 10, 11.50779448),
        ("precip", "mm", 25.4, 1),
        ("precip", "cm", 2.54, 1),
        ("precip", "inch", 0.5, 0.5),
    ],
)
def test_provider_unit_conversion(field, unit, amount, expected):
    assert convert(amount, unit, field) == pytest.approx(expected)


@pytest.mark.parametrize(
    "amount,unit",
    [(None, "inch"), (-1, "inch"), (float("nan"), "inch"), (2, "unknown"), (True, "inch")],
)
def test_invalid_weather_never_becomes_calm(amount, unit):
    assert convert(amount, unit, "precip") is None


def test_converted_shared_boundaries_remain_conservative():
    assert precipitation_risk(convert(6.35, "mm", "precip"), "rain") == 2
    assert precipitation_risk(convert(2.54, "cm", "precip"), "snow") == 2


def test_highest_condition_and_missing_weather():
    assert classify({"wind_mph": 12, "rain_in": 0.25, "snow_in": 2}, 0)["score"] == 3
    assert classify(None, 30000)["score"] is None
    assert classify({"wind_mph": 40, "rain_in": None, "snow_in": 0}, 0)["score"] is None
    risk = classify({"wind_mph": 55, "rain_in": None, "snow_in": 0}, 0)
    assert risk["score"] == 4 and not risk["complete"]


def point(mile, score, complete=True):
    return {"mile": mile, "risk": {"score": score, "complete": complete}}


def test_segment_endpoint_max_and_distance_weighted_average():
    result = aggregate([point(0, 0), point(10, 2), point(100, 3)])
    assert result["risk_miles"]["High"] == 10
    assert result["risk_miles"]["Severe"] == 90
    assert result["average_risk"] == pytest.approx(2.9)
    assert sum(result["risk_miles"].values()) == 100


def test_unknown_miles_and_known_no_travel_are_preserved():
    result = aggregate([point(0, None, False), point(10, 1), point(30, 4)])
    assert result["risk_miles"]["Unknown"] == 10
    assert result["risk_miles"]["No Travel"] == 20
    assert result["no_travel"] and not result["complete"]
    assert result["average_risk"] is None


def route(name, severe, high, average, seconds, complete=True, no_travel=False):
    return {
        "id": name,
        "name": name,
        "duration_seconds": seconds,
        "summary": {
            "risk_miles": {"Severe": severe, "High": high},
            "average_risk": average,
            "complete": complete,
            "no_travel": no_travel,
        },
    }


@pytest.mark.parametrize(
    "left,right",
    [
        (route("a", 0, 80, 2, 900), route("b", 1, 0, 1, 100)),
        (route("a", 0, 0, 2, 900), route("b", 0, 1, 1, 100)),
        (route("a", 0, 0, 1, 900), route("b", 0, 0, 2, 100)),
        (route("a", 0, 0, 1, 100), route("b", 0, 0, 1, 900)),
    ],
)
def test_lexicographic_priority(left, right):
    assert recommend([right, left])[0] == "a"


def test_no_travel_and_unknown_routes_are_ineligible():
    routes = [
        route("unknown", 0, 0, None, 1, complete=False),
        route("blocked", 0, 0, 0, 1, no_travel=True),
        route("safe", 5, 20, 2.5, 500),
    ]
    assert recommend(routes)[0] == "safe"
    assert recommend(routes[:2])[0] is None
    assert "Every route" in recommend([routes[1]])[1]
