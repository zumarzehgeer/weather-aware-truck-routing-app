# Waycast · Weather-Aware Truck Routing

A React + Django assessment application for comparing route weather exposure at a truck’s estimated arrival times. The map shows every available alternative, weather checkpoints, and a separate 0–48-hour forecast corridor.

**Status:** deployed at **[weather-aware-truck-routing-app.onrender.com](https://weather-aware-truck-routing-app.onrender.com/)**. The original ten review findings have been repaired, along with additional boundary/concurrency fixes. Hosted health, frontend assets and synthetic-demo desktop/mobile interactions pass. **Hosted live weather is currently rate-limited by Open-Meteo**: real geocoding and routes work, but unavailable forecasts remain unknown and prevent recommendations. See the [repair review](docs/CODE_REVIEW_FIXES.md) and [current validation](docs/VALIDATION.md). No assessment submission or employer contact has been made.

## Run locally

Requires **Python 3.12**, **Node 24**, and npm. No database server is needed. The public non-commercial routing, city-search and weather adapters and the standard OpenStreetMap basemap require no API key. Provider usage policies still apply.

```bash
bash scripts/setup.sh
# Optional local settings. Keep real values out of version control.
cp .env.example .env
bash scripts/dev.sh
```

Open the Vite development server on port **5173**. It proxies `/api` to Django on **8000**. `setup.sh` uses the committed Python version pins and npm lockfile, builds the frontend, and collects static files. It can be rerun. Django and the Docker image do not auto-load `.env`; `dev.sh` loads it, and deployments inject environment variables.

For native Windows PowerShell, use the virtual environment's `Scripts` directory and `npm.cmd` (avoids PowerShell's script execution policy):

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Set-Location frontend
npm.cmd ci
npm.cmd run build
Set-Location ..
.\.venv\Scripts\python.exe backend/manage.py collectstatic --noinput
.\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8000 --noreload
```

This serves the built app at **http://127.0.0.1:8000**. Set local configuration through PowerShell environment variables; this command does not load `.env`. For hot reload, run `npm.cmd run dev` in a second terminal inside `frontend` and open port **5173**.

Choose **Live routes** and select cities from search, or click **Explore the demo**. The demo always uses synthetic Chicago–Detroit paths and forecasts, with conspicuous labels. It never replaces failed live API calls. In demo mode, endpoints are fixed; departure, load, and checkpoint spacing remain interactive. The route comparison displays the evaluated inputs, so changing a form value cannot silently relabel older results.

Production-style local startup after setup:

```bash
PATH="$PWD/.venv/bin:$PATH" bash scripts/serve.sh
```

The production server serves the React build and API on port 8000 using Gunicorn and WhiteNoise. Rebuild **then collect static files and restart the server** after frontend changes.

## What is implemented

- City/town geocoding with debounced keyboard-accessible search and cancellation of obsolete requests.
- Departure in an explicitly selected IANA timezone; server converts to UTC. DST gaps and repeated local hours are rejected with an explanation. All trip result times use the evaluated trip’s selected timezone, including destination arrival (not the destination’s local zone).
- Load in pounds, with checkpoints every 10, 25, or 50 miles, including origin and destination.
- Up to three **distinct** OSRM routes. A provider returning fewer routes produces a visible explanation; the application never manufactures live alternatives.
- Edge-duration-based checkpoint ETAs; wind, total rainfall, and snowfall at those times.
- Distance-weighted risk, supplied load rules, lexicographic recommendations, and explicit unknown/No Travel handling.
- All route lines visible together; selected route highlighted with its checkpoints and popups, recommendation badge, route summaries, and an accessible checkpoint table.
- A forecast-based corridor grid with 49 hourly frames, timestamp, risk legend, layer toggles, fit controls, and zero API requests when scrubbing the slider.
- Responsive layouts, loading/error/empty/stale states, explicit demo labels and basemap failure notice.
- Backend tests, desktop/mobile Playwright tests, CI, Docker, deployment blueprint, and a [7–9 minute walkthrough script](docs/WALKTHROUGH.md).

## Architecture

```text
React + TypeScript + Leaflet
     │ same-origin JSON /api (Vite proxy in development)
Django views → validation and bounded requests
     │
     ├─ providers.py → OSRM / Open-Meteo + TTL caches
     ├─ geometry.py → annotated distance sampling / ETAs / corridor grid
     ├─ risk.py → pure risk classification / segment aggregation / ranking
     └─ service.py → trip orchestration and 49-frame corridor assembly
```

No persistence or authentication is needed. Cache entries and rate budgets are in process memory. Deployment intentionally uses **one Gunicorn worker with four threads**, with a routing lock and three concurrent weather batches. Multiple workers/replicas require a shared cache, distributed quota control, and a provider plan suitable for the resulting volume. This is a small assessment service, not an unbounded public routing platform.

## Providers and limits

| Purpose | Service | Contract / limits |
|---|---|---|
| Routing | [OSRM Route API](https://project-osrm.org/docs/v5.24.0/api/#route-service), public `router.project-osrm.org` | Requests `alternatives=3`, full GeoJSON and distance/duration edge annotations; retains at most three unique paths. This asks for alternatives beyond the primary route, so up to four provider results may arrive; only the first three distinct ones are shown. Cached 24h. Public demo has no SLA; requests serialized to at most one/second in this single worker. |
| Place search | [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api), GeoNames | City/town search, six results, 400ms debounce, cached 24h. Does not promise street-address geocoding. |
| Weather | [Open-Meteo Forecast API](https://open-meteo.com/en/docs) | Seven UTC forecast days, four hourly variables, 40 locations/batch, at most three concurrent outbound batches across all evaluations in one process. Cached 30m by coordinates rounded to 0.001°. Missing cells/fields stay unknown. |
| Basemap | [OpenStreetMap standard tiles](https://operations.osmfoundation.org/policies/tiles/) | HTTPS browser tiles with visible OSM attribution, normal HTTP caching and an explicit cross-origin referrer policy. Interactive viewing only; no prefetch, bulk download or offline feature. Best-effort service without an SLA; use an appropriate contracted/self-hosted provider for larger deployments. |

Official Open-Meteo documentation and terms were checked through the provider’s [website source](https://github.com/open-meteo/open-meteo-website) and [API source README](https://github.com/open-meteo/open-meteo). The free service is **non-commercial**, with published limits of **600 calls/minute, 5,000/hour, and 10,000/day**, without an SLA. Batching does not turn multiple locations into one quota unit. The app reserves location-based budgets of 500/minute, 4,500/hour, and 9,000/day, with limits of 220 unique forecast locations/plan, 1,600 miles/alternative, eight trip evaluations/minute/client and 30 searches/minute/client. Cache expiry, restarts, other applications on the same IP, and provider accounting can still cause rate limits; they are handled explicitly. Per-client limiting uses `REMOTE_ADDR`, so a reverse proxy may conservatively share that limit across clients. Do not trust arbitrary forwarded IP headers to bypass it.

**OSRM’s `driving` profile is not a truck routing profile.** It does not enforce height, width, axle/gross-weight restrictions, hazmat bans, commercial-road restrictions, closures, or mandatory breaks. Load affects weather classification only. ETAs exclude live traffic and stops. Use a licensed truck-capable provider and verified road data for operational truck navigation. Nothing here claims that a recommended route is safe to drive.

## Weather and risk interpretations

Wind is the forecast **10m sustained wind speed**, not gusts or crosswind relative to truck heading. Rain is `rain + showers` (large-scale plus convective rainfall); snow is snowfall depth, not snow water equivalent. All returned units are inspected: km/h, m/s, knots and mph are converted to mph; mm, cm and inches to inches. Snowfall may remain in cm even when imperial precipitation is requested. Conversion is rounded to ten decimal places to eliminate binary arithmetic dust at exact shared thresholds. Null, negative, non-finite and unsupported-unit values are unknown.

Precipitation at hourly timestamp `H` describes the preceding hour. For an ETA, choose the first hourly boundary **at or after ETA** (`ceil` to an hour), using that interval’s rain/snow and its end-of-hour sustained wind. This is an hourly approximation; no unsupported minute precision is implied. There is **no nearest-hour fallback** outside the returned series. A departure may be accepted inside seven days while a route’s later arrival is outside the actual returned horizon; that route becomes incomplete.

| Risk / score | Wind mph | Rain in/h | Snow in/h |
|---|---|---|---|
| Low / 0 | <25 | <0.10 | <0.5 |
| Moderate / 1 | 25 to <35 | 0.10 to <0.25 | 0.5 to <1.0 |
| High / 2 | 35 to <45 | 0.25 to <0.50 | 1.0 to <2.0 |
| Severe / 3 | 45 to <55 | 0.50 to **1.00 inclusive** | 2.0 to **3.0 inclusive** |
| No Travel / 4 | ≥55 | **>1.00** | **>3.0** |

At the overlapping rain/snow endpoints, the more conservative category wins, except the explicit **greater than** No Travel limits are preserved. Load **>30,000 lb** with wind **45 to <55 mph** means No Travel; load **>40,000 lb** with wind **35 to <45 mph** means Severe. Exactly 30,000/40,000 does not trigger its respective extra rule. Use the highest applicable weather/load risk.

Checkpoint locations are interpolated within the provider’s annotated edge distances, with elapsed time interpolated within the same edge’s duration. Edge sums are normalized to route totals to account for provider rounding. Each segment between two checkpoints inherits the **maximum risk of its endpoints**. Sum actual segment miles by category; average risk is `Σ(segment_miles × score) / total_miles`. This is more conservative than assigning only the departure checkpoint, but cannot discover events between sampled checkpoints.

An interval with a missing endpoint is unknown unless an endpoint already establishes No Travel. A route with any incomplete checkpoint is excluded from recommendation and its average is `null`, even if some conditions are known. Known No Travel remains visible even when another field is missing.

Rank only complete routes without No Travel, lexicographically by **Severe miles → High miles → distance-weighted average risk → duration**. Use unrounded values for comparisons, rounded values only for display. Identical ranks preserve provider order. If none is eligible, no route is recommended; a message distinguishes all-No-Travel from missing-data cases.

## Corridor layer versus trip evaluation

The heatmap is a **forecast risk grid**, not radar or a decorative gradient. A roughly 25-mile grid samples the trip corridor and lateral cells within about 26 miles of route samples. Every cell color uses real weather fetched at its center and the evaluated load. If coverage would exceed 64 cells, grid size increases rather than dropping a portion of the trip. Unknown data is gray. Spatial resolution is limited by the provider model and these representative cells; values are not continuous observations or exact conditions between samples. Antimeridian crossings are rejected, and supported coordinates are limited to ±85° latitude.

The slider’s +0h is the **next full UTC hour after the evaluation**, and +48h is 48 hours after that. Its visible timestamp is converted to the evaluated display timezone. It never changes route scores, recommendation, or the arrival-time checkpoint colors. All 49 snapshots arrive with the plan. Slider changes update the existing cell styles locally; route geometry stays memoized. No provider calls are made when selecting routes, opening popups, or scrubbing time.

## API contract

All coordinates in GeoJSON/checkpoints are **`[longitude, latitude]`**. Leaflet cell bounds are **`[[south, west], [north, east]]`**. Distances are miles, durations seconds, weather mph and inches/hour, and output timestamps ISO-8601 UTC.

- `GET /api/health` → `{ "status": "ok", "demo_enabled": true }`. Liveness only, not provider readiness.
- `GET /api/geocode?q=Chicago` → `{ "results": [{ "name", "latitude", "longitude", "timezone" }] }`.
- `POST /api/plan` with `Content-Type: application/json`:

```json
{
  "origin": { "name": "Chicago, Illinois, United States", "latitude": 41.8781, "longitude": -87.6298 },
  "destination": { "name": "Detroit, Michigan, United States", "latitude": 42.3314, "longitude": -83.0458 },
  "departure_local": "2026-10-16T08:00",
  "timezone": "America/Chicago",
  "load_lb": 32000,
  "spacing_miles": 25,
  "demo": false
}
```

Use a future departure within seven days; the date above is only a format example. Response: `mode`, `origin`, `destination`, evaluated inputs, `routes[]` with geometry/checkpoints/summary, `recommended_id` (nullable), `explanation`, `warnings[]`, `corridor.timestamps[49]`, `corridor.cells[].forecasts[49]`, provider disclosure, and generation time. Checkpoint `risk` has nullable `score`, `label`, `complete`, and `reasons`. Unavailable `weather` is null; individual missing measurements can also be null. No Travel can be known while `complete` is false.

Validation/provider errors use `{ "error": { "code": "...", "message": "..." } }`, with 400 validation, 403 disabled demo, 415 content type, 422 no route/trip limits, 429 app limit, 502 provider failure/malformed data and 503 provider rate limit. Partial weather outages return a successful plan with unknown values, warnings and no recommendation for incomplete routes. Unsupported HTTP methods use Django’s 405 response. No automatic retries amplify rate-limit failures.

## Environment variables

See [.env.example](.env.example). The current providers require no credentials for this assessment workflow. Follow their usage policies. If switching providers, follow the selected provider's rules for any browser-visible access key; keep secret credentials on the server and out of `VITE_*` variables.

| Variable | Purpose |
|---|---|
| `DJANGO_SECRET_KEY` | Random deployment secret, at least 40 characters; never commit it. |
| `DJANGO_REQUIRE_SECRET` | `true` in Docker/production; refuses missing/example keys. Local default false. |
| `DJANGO_DEBUG` | Local debugging only; default false. |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated hostnames. Render’s `RENDER_EXTERNAL_HOSTNAME` is also accepted automatically. |
| `ENABLE_DEMO` | Explicit synthetic workflow; default true. Set false to disable it. |
| `OSRM_BASE_URL`, `WEATHER_BASE_URL`, `GEOCODING_BASE_URL` | HTTPS provider bases, no trailing slash. Kept server-side; not accepted from requests. |
| `PROVIDER_USER_AGENT` | Provider client identification. Set a project/contact identifier for hosting. |
| `TRUST_PROXY` | Trust `X-Forwarded-Proto` only behind a proxy that strips/sets it. Default false. |
| `SECURE_SSL_REDIRECT` | Enable when deployment TLS/health-check arrangement supports it. Default false. |
| `PORT` | Gunicorn port; default 8000. |

## Verification

```bash
.venv/bin/pytest -q
(cd frontend && npm run build)
(cd frontend && npm run test:unit)
.venv/bin/python backend/manage.py collectstatic --noinput
.venv/bin/python backend/manage.py check
(cd frontend && npx playwright install --with-deps chromium && npm run test:e2e)
```

If Chromium is already installed, skip its download and run `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e` inside `frontend`. Playwright starts a fresh Django server on 8000, so stop your development server first. Tests use the real Django demo endpoint plus explicitly intercepted failure fixtures; they do not consume live weather quotas. Desktop and mobile suites cover route selection, real map checkpoint popups, layer toggles, slider updates without API calls, guide modal, mobile overflow, search keyboard selection, validation, loading, errors, missing forecasts and No Travel messages.

On Windows, backend tests use `.\.venv\Scripts\python.exe -m pytest -q`. Inside `frontend`, run `npm.cmd run test:unit`, `npx.cmd playwright install chromium`, and `npm.cmd run test:e2e`; Playwright selects the platform's Python path automatically. Unit tests verify request cancellation/deadlines, response-body deadlines, cleanup and duration rounding. Browser tests also cover both endpoint popups, unresolved-place swapping and disabled demo entry points. Automated browser runs abort basemap requests; actual tile content was verified separately.

Backend tests cover every supplied threshold/load boundary, unit conversion, numerical conversion boundaries, annotation-based ETAs, endpoint/remainder sampling, weighted aggregation, each ranking priority, unknown/No Travel exclusion, DST validation, malformed inputs, provider timeout/rate limit/malformed responses, cache reuse and fewer-route disclosure. See [validation evidence and remaining checks](docs/VALIDATION.md).

## Deployment

See [precise Docker and Render instructions](docs/DEPLOYMENT.md). A tested multi-stage Dockerfile serves both frontend and backend under a single origin, with a non-root runtime, startup secret validation, static compression, a health check, and bounded Gunicorn concurrency. `render.yaml` prepares a free-tier Blueprint; it has **not** created infrastructure or incurred charges.

The user deployed commit `f32f764` as a Docker web service on Render Free. The public URL is **https://weather-aware-truck-routing-app.onrender.com/**. Hosted synthetic smoke and desktop/mobile interaction checks passed. The hosted live smoke currently fails its forecast-completeness assertion because Open-Meteo returns a rate limit; do not describe live weather as verified until a later check succeeds. The service may cold-start after inactivity. Current documentation edits are local until committed/pushed.

## Known limits

- Public demonstration routing and non-commercial weather providers have no availability guarantee; a commercial operational deployment requires appropriate contracts and truck-aware routing.
- Forecast intervals, coarse corridor cells, point sampling and this supplied risk model are approximations. Gusts, ice, visibility, flooding, terrain exposure, traffic, restrictions and driver hours are not modeled.
- City endpoints may snap to nearby public roads; no truck stop/address precision is promised.
- Single-worker memory caches and budgets are intentionally simple and reset on restart. There is no durable quota ledger, distributed cache, or production abuse protection.
- Provider access depends on the local or deployment network. A live Chicago–Detroit trip and a geographic OpenStreetMap tile were verified during local repair validation. Automated fixture tests alone do not establish provider readiness; see the current validation record.
