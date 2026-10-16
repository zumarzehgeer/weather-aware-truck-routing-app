# Waycast · Weather-Aware Truck Routing

Waycast compares driving routes using forecast weather at a truck's estimated arrival times. It shows route alternatives, load-sensitive weather risk, checkpoint details, and a separate 48-hour corridor forecast.

**Hosted application:** [weather-aware-truck-routing-app.onrender.com](https://weather-aware-truck-routing-app.onrender.com/). Public providers can throttle requests; the last hosted check encountered a weather rate limit. The app shows missing forecasts as Unknown and withholds recommendations for incomplete routes. A clearly labelled synthetic demo is available independently. See [validation](docs/VALIDATION.md) for dated results.

## Features

- City/town search with keyboard navigation, debouncing and cancellation of obsolete requests.
- Departure date, IANA timezone, truck load, and weather checkpoints every 10, 25 or 50 miles.
- Up to three distinct OSRM alternatives, with provider route-count disclosure.
- Arrival-time wind, rain and snow; risk miles, distance-weighted scores, and explained recommendations.
- Leaflet map with route selection, checkpoint popups, a checkpoint table, layer toggles and fit controls.
- A 49-frame hourly corridor forecast that can be explored without additional API requests.
- Responsive desktop/phone layouts, loading and validation messages, provider warnings, and stale-result labels.
- Explicit synthetic Chicago–Detroit demo; failed live requests never silently switch to demo data.

The navy/turquoise interface is inspired by [Spotter](https://spotter.ai/) and uses Waycast's own identity. Manrope is bundled locally through Fontsource; its [SIL Open Font License](frontend/public/assets/Manrope-OFL.txt) is included.

## Run locally

Requirements: **Python 3.12 or 3.13**, **Node 24**, and npm. CI and Docker use Python 3.12. No database setup, migrations, or API keys are needed for the default public providers.

### Windows · Git Bash

Run once from the repository root:

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
npm --prefix frontend ci
```

Open two terminals at the repository root:

```bash
# Terminal 1: Django API on port 8000
npm run backend
```

```bash
# Terminal 2: Vite frontend on port 5173
npm run frontend
```

Open **http://localhost:5173**. Stop each server with **Ctrl+C**. Both reload source changes. No environment activation or root `npm install` is needed. The frontend refuses to start if port 5173 is occupied. In PowerShell, use `npm.cmd` instead of `npm` if execution policy blocks npm's script.

### Linux / macOS

```bash
bash scripts/setup.sh
npm run backend
# In a second terminal:
npm run frontend
```

Alternatively, `bash scripts/dev.sh` starts both servers together. Vite proxies `/api` to Django on port 8000. The backend launcher selects the platform's virtual-environment Python and loads an optional root `.env`; `dev.sh` also loads `.env`. Django and the production container do not auto-load it.

### Try the demo

Select **Demo trip**, set departure roughly one hour ahead in the displayed timezone, and click **Compare demo routes**. Demo endpoints are fixed to Chicago–Detroit; departure, load and checkpoint spacing remain editable. Select an alternative, open a checkpoint, and explore the timeline. Changing trip inputs marks the existing analysis as outdated until another comparison succeeds.

For live data, choose **Live routes** and select both cities from search results. Typing an unresolved city name alone is insufficient. Actual routes and forecasts depend on provider availability.

## Architecture

```text
frontend/src/         React + TypeScript + Leaflet interface
backend/config/       Django settings, URLs and WSGI
backend/routing/
  views.py            Request validation and application rate limits
  providers.py        OSRM, geocoding, weather adapters and TTL caches
  geometry.py         Edge-based checkpoint sampling, ETAs and corridor grid
  risk.py             Pure classification, aggregation and route ranking
  service.py          Trip orchestration and forecast assembly
  demo.py             Explicit synthetic fixtures
backend/routing/tests/  Backend regression tests
frontend/tests/         Desktop/mobile Playwright tests
frontend/tests-unit/    Request and formatting unit tests
scripts/                Setup, local startup, production startup and smoke checks
docs/                   Deployment instructions and validation summary
```

The React app and JSON API share an origin in production. Gunicorn and WhiteNoise serve the Django API and built frontend. No persistence or authentication is required. Production uses one Gunicorn worker with four threads so in-memory cache and quota controls are shared. Multiple workers/replicas require shared caching and distributed quota control.

## Weather and risk model

Checkpoints are interpolated along the provider's annotated edge distances and travel times. For each ETA, the backend selects the first hourly forecast boundary at or after arrival. Rain/snow represent the preceding hourly interval; wind is the sustained 10 m forecast at that boundary. There is no nearest-hour fallback beyond the returned series. Rain includes rain plus showers; units are normalized to mph and inches/hour. Missing or invalid values remain Unknown.

| Risk / score | Wind mph | Rain in/h | Snow in/h |
|---|---|---|---|
| Low / 0 | <25 | <0.10 | <0.5 |
| Moderate / 1 | 25 to <35 | 0.10 to <0.25 | 0.5 to <1.0 |
| High / 2 | 35 to <45 | 0.25 to <0.50 | 1.0 to <2.0 |
| Severe / 3 | 45 to <55 | 0.50 to 1.00 inclusive | 2.0 to 3.0 inclusive |
| No Travel / 4 | ≥55 | >1.00 | >3.0 |

Supplied load rules override wind classification:

- Load **>30,000 lb** and wind **45 to <55 mph**: No Travel.
- Load **>40,000 lb** and wind **35 to <45 mph**: Severe.
- Wind **≥55 mph**: No Travel at any load.

Each checkpoint takes the highest applicable risk. Each interval inherits the higher risk of its two endpoints. Miles are added by category; average risk is `Σ(interval miles × score) / total miles`. A missing endpoint makes an interval Unknown unless No Travel is already established. An incomplete route has no average score and cannot be recommended.

Eligible routes must have complete forecasts and no No Travel conditions. They are ranked by **Severe miles → High miles → distance-weighted average risk → duration**, using unrounded values. If none is eligible, no route is recommended.

### Corridor timeline versus arrival-time analysis

The colored corridor is a forecast grid, not radar. Representative cells cover the alternatives and their surroundings, with a maximum of 64 cells; longer corridors use coarser cells. Each uses center-point weather and the evaluated load.

The slider begins at the **next full UTC hour after evaluation** and includes 49 frames through +48h. Timestamps display in the evaluated trip's timezone. Scrubbing changes corridor colors only; route cards and checkpoint dots retain arrival-time risk. All frames arrive with the plan, so selecting routes, opening popups and moving the slider make no further provider requests.

## Providers and limits

| Purpose | Provider | Application behavior |
|---|---|---|
| Routing | [OSRM Route API](https://project-osrm.org/docs/v5.24.0/api/#route-service) | Full GeoJSON and edge distance/duration annotations; retains up to three unique paths. Fewer alternatives are disclosed. Cached 24h; outbound routing requests serialized to at most one/second. |
| City search | [Open-Meteo geocoding / GeoNames](https://open-meteo.com/en/docs/geocoding-api) | City/town results, not street addresses; six suggestions, 400 ms debounce, 24h cache. |
| Weather | [Open-Meteo](https://open-meteo.com/en/docs) | Seven UTC forecast days; 40 locations/batch, at most three concurrent batches; 30-minute location cache. Missing forecasts are never treated as low risk. |
| Basemap | [OpenStreetMap standard tiles](https://operations.osmfoundation.org/policies/tiles/) | Visible attribution, normal browser caching and identifying referrer policy; no bulk download or offline prefetch. |

Application limits: 1,600 miles per alternative, 220 unique weather locations per plan, eight trip evaluations/minute/client, and 30 searches/minute/client. Location-based weather budgets are 500/minute, 4,500/hour and 9,000/day in the single worker. Batching does not make multiple locations one quota unit. Restarts, shared outbound IPs and provider accounting can still cause upstream limits. Per-client limiting uses `REMOTE_ADDR`, so a reverse proxy may conservatively share the limit across callers.

Default public routing/weather services have no availability guarantee; Open-Meteo's free endpoint is for non-commercial use. Follow each provider's current usage terms. Operational use requires appropriate provider access and truck-aware routing.

## API

- `GET /api/health` → liveness and `demo_enabled`; does not establish provider readiness.
- `GET /api/geocode?q=Chicago` → named places with latitude, longitude and timezone.
- `POST /api/plan` with JSON:

```json
{
  "origin": { "name": "Chicago", "latitude": 41.8781, "longitude": -87.6298 },
  "destination": { "name": "Detroit", "latitude": 42.3314, "longitude": -83.0458 },
  "departure_local": "2026-10-16T08:00",
  "timezone": "America/Chicago",
  "load_lb": 32000,
  "spacing_miles": 25,
  "demo": false
}
```

Replace the example departure with a future time within seven days. DST gaps and repeated local hours are rejected explicitly. Results display in the evaluated departure timezone, including destination arrival.

The response includes evaluated inputs, routes with geometry/checkpoints/summaries, nullable `recommended_id`, explanation, warnings, corridor timestamps/cell forecasts, provider disclosure and generation time. Geometry coordinates use **[longitude, latitude]**; Leaflet cell bounds use **[[south, west], [north, east]]**. Distances are miles, durations seconds and output timestamps UTC ISO-8601.

Errors use `{ "error": { "code": "...", "message": "..." } }`: 400 validation, 403 disabled demo, 415 content type, 422 trip/routing limits, 429 application limit, 502 provider failure and 503 provider throttling. Partial weather failures can return a plan with Unknown values and no recommendation for incomplete routes.

## Configuration

See [.env.example](.env.example). Keep real `.env` files and secret values out of version control.

| Variable | Purpose |
|---|---|
| `DJANGO_SECRET_KEY`, `DJANGO_REQUIRE_SECRET` | Production requires a random non-example key of at least 40 characters. |
| `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS` | Local debugging and permitted hostnames; Render's injected hostname is accepted automatically. |
| `ENABLE_DEMO` | Enable the explicit synthetic workflow; default true. |
| `OSRM_BASE_URL`, `WEATHER_BASE_URL`, `GEOCODING_BASE_URL` | Server-side provider endpoints. |
| `PROVIDER_USER_AGENT` | Project/contact identification for provider requests. |
| `TRUST_PROXY`, `SECURE_SSL_REDIRECT` | TLS proxy configuration; trust only a proxy that sanitizes forwarded protocol headers. |
| `PORT` | Production listener port; default 8000. |

## Verification

From the repository root in Windows Git Bash:

```bash
.venv/Scripts/python.exe -m pytest -q
npm --prefix frontend run test:unit
npm --prefix frontend run build
.venv/Scripts/python.exe backend/manage.py check
(cd frontend && npx playwright install chromium)
npm --prefix frontend run test:e2e
```

On Linux/macOS, substitute `.venv/bin/python` for `.venv/Scripts/python.exe`. Install the browser from the frontend directory with `npx playwright install --with-deps chromium` if system dependencies are needed. The default browser suite collects built assets and starts its own Django server on port 8000; stop an existing server first.

To test servers that are already running instead:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npm --prefix frontend run test:e2e
```

Browser tests use the real Django synthetic-demo endpoint and explicit failure fixtures, and suppress basemap requests. They do not consume live weather quotas or establish live provider readiness. Backend tests cover risk boundaries, geometry/timing, input validation, provider responses, caches and concurrency. Frontend unit tests cover request cancellation/deadlines and formatting. CI runs setup, tests and the production build. See the [validation summary](docs/VALIDATION.md).

For smoke checks against a running deployment:

```bash
.venv/Scripts/python.exe scripts/smoke.py --base-url https://YOUR-HOST
# Optional real-provider check; consumes provider quota:
.venv/Scripts/python.exe scripts/smoke.py --base-url https://YOUR-HOST --live
```

## Deployment and limitations

See [Docker and Render deployment instructions](docs/DEPLOYMENT.md). The multi-stage Docker image builds the frontend, collects static assets and runs as a non-root user. `render.yaml` defines a single Docker web service; a separate frontend host, database or persistent disk is unnecessary.

OSRM's driving profile does **not** enforce commercial truck height, weight, hazmat or road restrictions. Load affects the weather model only. ETAs exclude live traffic, stops and rest breaks. Forecast grids, hourly values and checkpoint sampling are approximations; gusts, ice, visibility, terrain exposure and flooding are not modeled. A recommendation under this supplied model does not establish driving safety. In-memory budgets reset on restart and are not distributed abuse protection.
