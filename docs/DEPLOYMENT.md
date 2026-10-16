# Deployment

Waycast serves its React build and Django API from one Docker web service. No database setup, migrations, persistent disk or separate frontend host is required.

Hosted application: [weather-aware-truck-routing-app.onrender.com](https://weather-aware-truck-routing-app.onrender.com/). See [validation](VALIDATION.md) for dated provider checks; deployment success alone does not establish live-weather readiness.

## Docker

From the repository root in Bash:

```bash
docker build -t waycast:assessment .
export DJANGO_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
docker run --rm --name waycast -p 8000:8000 \
  -e DJANGO_SECRET_KEY \
  -e DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1 \
  -e ENABLE_DEMO=true waycast:assessment
```

Open http://127.0.0.1:8000. The image builds and collects static files, then runs Gunicorn/WhiteNoise as UID 10001. It requires a non-example secret of at least 40 characters. The listener uses `PORT`, default 8000; `/api/health` is the container health check. Hosted secrets belong in the host's environment settings.

One worker with four threads intentionally shares in-memory caches and quotas. Multiple workers or replicas require shared cache and distributed quota controls. Public deployment should sit behind a TLS proxy. Enable `TRUST_PROXY=true` only when the proxy strips and sets `X-Forwarded-Proto`; configure `SECURE_SSL_REDIRECT` to suit that proxy and its health checks.

## Render

The repository includes a Docker Blueprint in `render.yaml`. Connect the intended GitHub branch through Render's Blueprint flow, or create a Docker Web Service manually with the repository root as its build context.

| Setting | Value |
|---|---|
| Runtime | Docker |
| Root directory | Repository root (leave blank in the manual form) |
| Dockerfile | `./Dockerfile` |
| Health check | `/api/health` |
| `DJANGO_SECRET_KEY` | Generated random secret, at least 40 characters |
| `DJANGO_REQUIRE_SECRET` | `true` |
| `DJANGO_DEBUG` | `false` |
| `TRUST_PROXY` | `true` behind Render's TLS proxy |
| `ENABLE_DEMO` | `true` to expose the labelled synthetic workflow |
| `WEATHER_TRANSPORT` | `browser` (also the automatic default when Render injects its hostname) |

The app accepts `RENDER_EXTERNAL_HOSTNAME` automatically. Add any custom domain to `DJANGO_ALLOWED_HOSTS`. Configure `PROVIDER_USER_AGENT` with project/contact identification. The Blueprint specifies the free plan; review available plans and terms in the host dashboard. Free services may sleep and take time to start after inactivity.

For updates, push the intended code and verify Render deploys the expected commit. The Docker build must rebuild the frontend and collect static files together; do not reuse collected assets from a different frontend build.

## Outbound services

The server requires HTTPS access to `router.project-osrm.org` and `geocoding-api.open-meteo.com`. In browser weather mode, visitors also require access to `api.open-meteo.com`; server mode requires that access from the server instead. The browser requests `tile.openstreetmap.org` for the basemap. Keep TLS verification enabled.

Preserve visible OpenStreetMap attribution, normal browser tile caching and the map's `strict-origin-when-cross-origin` referrer policy. Do not add bulk downloads or offline prefetch. Public demo providers have no availability guarantee; operational use needs suitable provider agreements and truck-aware routing.

## Release checks

Against the assigned HTTPS address:

```bash
python scripts/smoke.py --base-url https://YOUR-HOST
# Optional real-provider check; consumes quota:
python scripts/smoke.py --base-url https://YOUR-HOST --live
```

The default checks health, frontend assets and the labelled synthetic trip. `--live` also checks actual geocoding, routes and complete arrival-time forecasts. A live failure is never replaced with fixtures. In the browser, also verify actual basemap content, route selection, checkpoint popups, the timeline, warnings and the phone layout.

## Weather throttling

The free weather API permits one concurrent request per IP. The adapter serializes weather requests across evaluations and retries a concurrency rejection at most twice with short backoff. It honors `Retry-After`, pauses outbound weather calls after exhausted quotas, and distinguishes concurrency/minute/hour/day rejection categories. Cached successful forecasts remain usable during the pause; missing data is never filled with synthetic weather. Shared hosting egress can still be affected by other applications. See the [provider's concurrency explanation](https://github.com/open-meteo/open-meteo/issues/1650).

A hosted check on 16 October confirmed a daily quota rejection from the server weather path. Render now defaults to browser-assisted weather: Django prepares the real routes and samples, while the visitor fetches the public CORS forecast API sequentially. A bounded 30-minute browser cache avoids repeated forecast requests for the same locations. Django validates uploaded forecasts and computes risk using server-owned trip inputs. Weather transported by the browser is untrusted client input; it is not a server-authenticated feed and results are not persisted or shared. Preparation tokens expire in three minutes and can be used once.

Visitors remain subject to normal provider limits. HTTP 429 pauses new browser weather requests for 60 seconds; failed weather remains Unknown. Repeated comparisons or redeployments cannot reset quotas. Switching transport changes where requests originate, without adding credentials, a proxy or a paid provider. See the dated [validation record](VALIDATION.md).

The free Open-Meteo endpoint is for non-commercial access. If changing to a customer API, implement and test server-side authentication first: changing `WEATHER_BASE_URL` alone does not add an API key. Never put secret credentials in browser code or `VITE_*` variables.
