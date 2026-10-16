import math
from bisect import bisect_right
from datetime import timedelta

METERS_PER_MILE = 1609.344


def haversine(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, [*a, *b])
    d = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 6371008.8 * 2 * math.asin(min(1, math.sqrt(d)))


def sample_route(route, spacing_miles, departure):
    coords = route["geometry"]
    distances, durations = route["edge_distances"], route["edge_durations"]
    if len(coords) < 2 or len(distances) != len(coords) - 1 or len(durations) != len(distances):
        raise ValueError("Routing geometry and edge annotations do not align")
    if any(abs(b[0] - a[0]) > 180 for a, b in zip(coords, coords[1:])):
        raise ValueError("Antimeridian-crossing routes are outside the supported map extent")
    if any(not math.isfinite(x) or x < 0 for x in distances + durations):
        raise ValueError("Invalid routing annotations")
    distance_sum, duration_sum = sum(distances), sum(durations)
    if (
        not math.isfinite(distance_sum)
        or not math.isfinite(duration_sum)
        or distance_sum <= 0
        or duration_sum <= 0
    ):
        raise ValueError("Route has no measurable distance or duration")
    # Normalize annotation rounding to the provider's route totals.
    dscale, tscale = (
        route["distance_meters"] / distance_sum,
        route["duration_seconds"] / duration_sum,
    )
    cumulative_d, cumulative_t = [0.0], [0.0]
    for distance, duration in zip(distances, durations):
        cumulative_d.append(cumulative_d[-1] + distance * dscale)
        cumulative_t.append(cumulative_t[-1] + duration * tscale)
    total, spacing = route["distance_meters"], spacing_miles * METERS_PER_MILE
    targets = [i * spacing for i in range(math.ceil(total / spacing))] + [total]
    points = []
    for target in targets:
        edge = min(max(0, bisect_right(cumulative_d, target) - 1), len(distances) - 1)
        length = cumulative_d[edge + 1] - cumulative_d[edge]
        fraction = min(1, max(0, (target - cumulative_d[edge]) / length)) if length else 1
        a, b = coords[edge], coords[edge + 1]
        position = [a[j] + fraction * (b[j] - a[j]) for j in (0, 1)]
        elapsed = cumulative_t[edge] + fraction * (cumulative_t[edge + 1] - cumulative_t[edge])
        if target == 0:
            position, elapsed = coords[0], 0
        elif target == total:
            position, elapsed = coords[-1], route["duration_seconds"]
        points.append(
            {
                "coordinate": position,
                "mile": target / METERS_PER_MILE,
                "arrival": (departure + timedelta(seconds=elapsed)).isoformat(),
                "elapsed_seconds": elapsed,
            }
        )
    return points


def corridor_cells(routes, departure):
    """~25-mile grid cells within ~25 miles of sampled alternative paths, capped at 64."""
    points = [p["coordinate"] for r in routes for p in sample_route(r, 20, departure)]
    lat_step = 0.36
    mid_lat = sum(p[1] for p in points) / len(points)
    lon_step = lat_step / max(0.2, math.cos(math.radians(mid_lat)))
    cells = {}
    for lon, lat in points:
        cx, cy = grid_index(lon, lon_step, 180), grid_index(lat, lat_step, 85)
        for dx, dy in [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)]:
            x, y = cx + dx, cy + dy
            cell = grid_cell(x, y, lon_step, lat_step)
            if cell is None:
                continue
            center = cell["coordinate"]
            if min(haversine(center, p) for p in points) <= 42000:
                cells[(x, y)] = cell
    # Expand grid for long trips; recompute rather than discard parts of the corridor.
    if len(cells) > 64:
        factor = math.ceil(len(cells) / 64) ** 0.5
        coarser = coarse_corridor(points, factor)
        while len(coarser) > 64:
            factor *= 1.5
            coarser = coarse_corridor(points, factor)
        return coarser
    return list(cells.values())


def coarse_corridor(points, factor):
    lat_step = 0.36 * factor
    lon_step = lat_step / max(0.2, math.cos(math.radians(sum(p[1] for p in points) / len(points))))
    cells = {}
    for lon, lat in points:
        x, y = grid_index(lon, lon_step, 180), grid_index(lat, lat_step, 85)
        cell = grid_cell(x, y, lon_step, lat_step)
        if cell is not None:
            cells[(x, y)] = cell
    return list(cells.values())


def grid_index(value, step, extent):
    # Choose the interior cell at exact extent edges, away from rounding slivers.
    return math.floor(max(-extent + 1e-9, min(extent - 1e-9, value)) / step)


def grid_cell(x, y, lon_step, lat_step):
    """Clip edge cells to the supported extent and sample their actual center."""
    west, east = max(-180, x * lon_step), min(180, (x + 1) * lon_step)
    south, north = max(-85, y * lat_step), min(85, (y + 1) * lat_step)
    # Grid multiplication can create a sub-ulp sliver at an exact extent edge.
    west = -180 if abs(west + 180) < 1e-10 else west
    east = 180 if abs(east - 180) < 1e-10 else east
    south = -85 if abs(south + 85) < 1e-10 else south
    north = 85 if abs(north - 85) < 1e-10 else north
    if east - west < 1e-10 or north - south < 1e-10:
        return None
    return {
        "coordinate": [(west + east) / 2, (south + north) / 2],
        "bounds": [[south, west], [north, east]],
    }
