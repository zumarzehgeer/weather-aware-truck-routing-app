"""Pure, distance-weighted assessment rules. No provider or Django dependency."""

import math

LABELS = ["Low", "Moderate", "High", "Severe", "No Travel"]
COLORS = ["#38bca4", "#c4ce69", "#f4b35f", "#f47c63", "#d95283"]


def valid(value):
    return (
        isinstance(value, (float, int))
        and not isinstance(value, bool)
        and math.isfinite(value)
        and value >= 0
    )


def wind_risk(wind, load):
    if wind >= 55 or (wind >= 45 and load > 30000):
        return 4
    if wind >= 45 or (wind >= 35 and load > 40000):
        return 3
    return 2 if wind >= 35 else 1 if wind >= 25 else 0


def precipitation_risk(value, kind):
    a, b, c, d = (0.1, 0.25, 0.5, 1.0) if kind == "rain" else (0.5, 1.0, 2.0, 3.0)
    # Shared boundaries choose the higher category; explicit > No Travel is preserved.
    return 4 if value > d else 3 if value >= c else 2 if value >= b else 1 if value >= a else 0


def classify(weather, load):
    names = ("wind_mph", "rain_in", "snow_in")
    weather = weather or {}
    missing = [name for name in names if not valid(weather.get(name))]
    factors = {}
    if "wind_mph" not in missing:
        factors["Wind"] = wind_risk(weather["wind_mph"], load)
    if "rain_in" not in missing:
        factors["Rain"] = precipitation_risk(weather["rain_in"], "rain")
    if "snow_in" not in missing:
        factors["Snow"] = precipitation_risk(weather["snow_in"], "snow")
    known = max(factors.values(), default=0)
    score = 4 if known == 4 else None if missing else known
    reasons = [f"{name}: {LABELS[risk]}" for name, risk in factors.items() if risk > 0]
    if missing:
        reasons.append("Forecast unavailable: " + ", ".join(missing))
    return {
        "score": score,
        "label": LABELS[score] if score is not None else "Unknown",
        "complete": not missing,
        "reasons": reasons or ["All supplied thresholds below Moderate"],
    }


def aggregate(checkpoints):
    miles = {label: 0.0 for label in LABELS + ["Unknown"]}
    weighted = 0
    for left, right in zip(checkpoints, checkpoints[1:]):
        length = right["mile"] - left["mile"]
        scores = (left["risk"]["score"], right["risk"]["score"])
        score = 4 if 4 in scores else None if None in scores else max(scores)
        miles["Unknown" if score is None else LABELS[score]] += length
        weighted += length * (score or 0)
    total = sum(miles.values())
    complete = all(p["risk"]["complete"] for p in checkpoints)
    return {
        "risk_miles": miles,
        "average_risk": weighted / total if total and complete else None,
        "complete": complete,
        "no_travel": any(p["risk"]["score"] == 4 for p in checkpoints),
    }


def recommend(routes):
    eligible = [r for r in routes if r["summary"]["complete"] and not r["summary"]["no_travel"]]
    if not eligible:
        if all(r["summary"]["no_travel"] for r in routes):
            return (
                None,
                "Every route contains No Travel conditions. Change your departure or trip; none can be recommended under the supplied rules.",
            )
        return (
            None,
            "No fully evaluated route is eligible. Missing forecasts prevent a recommendation; routes with No Travel conditions are excluded.",
        )
    ordered = sorted(
        eligible,
        key=lambda r: (
            r["summary"]["risk_miles"]["Severe"],
            r["summary"]["risk_miles"]["High"],
            r["summary"]["average_risk"],
            r["duration_seconds"],
        ),
    )
    winner = ordered[0]
    s = winner["summary"]
    return winner["id"], (
        f"{winner['name']} has {s['risk_miles']['Severe']:.1f} Severe miles, "
        f"{s['risk_miles']['High']:.1f} High miles, and {s['average_risk']:.2f}/4 distance-weighted risk. "
        "Eligible routes are compared in that order, then by travel time. Incomplete and No Travel routes are excluded."
    )
