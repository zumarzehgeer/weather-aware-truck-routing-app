# Deployment handoff

The user deployed commit `f32f764` on **Render Free** at **https://weather-aware-truck-routing-app.onrender.com/** on 15 October 2026. Health, frontend assets, synthetic smoke and hosted desktop/mobile demo interactions passed. Hosted live geocoding/routing works, but weather currently returns an upstream rate limit and remains unknown. See [current validation](VALIDATION.md). No paid resource was provisioned by the assistant. The app does not need a database, migrations, persistent disk, or a separate frontend host.

## Container

From the repository root:

```bash
docker build -t waycast:assessment .
# Generate securely; this value remains in the environment, not in source.
export DJANGO_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
docker run --rm --name waycast -p 8000:8000 \
  -e DJANGO_SECRET_KEY -e DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1 \
  -e ENABLE_DEMO=true waycast:assessment
```

Use the host’s secure environment settings instead of shell history for a hosted production secret. The container requires a non-example key of at least 40 characters, runs as UID 10001, and listens on `$PORT` (8000 by default). Set `DJANGO_ALLOWED_HOSTS` to the public hostname. Bind only behind a TLS proxy for public use. Enable `TRUST_PROXY=true` only if the proxy owns and sanitizes `X-Forwarded-Proto`. Gunicorn has one threaded worker so in-memory cache/rate controls are shared.

### Managed cloud proxy

On this Codex environment, preserve the injected Docker configuration and use the local managed daemon. HTTPS verification must remain enabled. Session CA files must not be copied into the image:

```bash
BUILDX_CONFIG=/workspace/.cache/waycast-buildx \
docker --host=unix:///var/run/docker.sock build \
  --secret id=proxy_ca,src=/etc/ssl/certs/ca-certificates.crt \
  -t waycast:assessment .
```

The optional BuildKit secret is used only in networked npm/pip steps. At runtime, mount the combined trusted CA bundle read-only and set `SSL_CERT_FILE=/run/proxy-ca.pem` for HTTPX. Retain Docker’s supplied proxy defaults. Ordinary deployment hosts use their normal CA store and do not require this mount. If client context/TLS variables override the managed socket, clear only those selectors for the command as described by the runtime skill; keep `DOCKER_CONFIG` and registry authentication intact.

## Render Blueprint

1. Commit and push these files to the GitHub branch you intend to deploy. No commit/push was performed automatically.
2. In your own Render account, choose a new Blueprint and connect this repository/branch. The root `render.yaml` declares a Docker web service and `/api/health` check.
3. Review the proposed **free** plan and current Render terms before creating it. Do not accept a paid plan without deciding to incur charges. If the free plan is unavailable, choose an existing approved Docker host instead.
4. Render generates `DJANGO_SECRET_KEY`; leave `DJANGO_DEBUG=false` and `DJANGO_REQUIRE_SECRET=true`. The app automatically permits Render’s injected `RENDER_EXTERNAL_HOSTNAME`. Add any custom domain to `DJANGO_ALLOWED_HOSTS`. Update `PROVIDER_USER_AGENT` for your project.
5. Deploy and wait for the build and health check. A free service may sleep/cold-start; allow time before retrying. No persistent disk is required.
6. At the assigned HTTPS address, verify the root page and assets; search for cities; submit a **live** trip departing soon. Confirm actual geometry, weather, route count disclosure, checkpoint details and recommendations. Scrub the forecast slider and verify it does not call `/api/plan` again. Run the explicit demo separately and verify its label stays visible.
7. Record the assigned HTTPS URL and the results of those live checks in `docs/VALIDATION.md`. Only then use the URL in your assessment delivery.

## Required outbound destinations

Server: `router.project-osrm.org`, `geocoding-api.open-meteo.com`, `api.open-meteo.com` (HTTPS 443). Browser: `tile.openstreetmap.org` for tiles. Package/build destinations are handled by the cloud package-manager preset. No raw provider keys are required.

Keep the map's OpenStreetMap attribution visible and preserve the TileLayer's `strict-origin-when-cross-origin` referrer policy. It overrides Django's document-wide `same-origin` policy so browser tile requests identify the site. Normal browser HTTP caching must remain enabled; do not add prefetch/offline/bulk tile downloads. Read the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/) before hosting. This community service has no SLA; larger deployments need a provider suited to their traffic.

The previous cloud onboarding draft used the earlier tile hostname. If reusing that environment, update its browser allowlist to `tile.openstreetmap.org`; saving a draft does **not** apply its network policy or publish a snapshot. Local networking and public deployment networking are separately controlled by their hosts. Never disable TLS to work around denial.

## Release validation

```bash
# Against a running local production server/container:
python3 scripts/smoke.py --base-url http://127.0.0.1:8000
# Against your actual deployed HTTPS URL, once available:
python3 scripts/smoke.py --base-url https://YOUR-HOST --live
```

The default checks the labeled demo, assets and health. `--live` checks city geocoding and a real near-term route/weather plan; it makes external requests and consumes free quotas. A live failure is not replaced by fixtures. Inspect provider throttles/availability/network policy before retrying. The script reports forecast incompleteness as a failed live-readiness check.

For production operations beyond this assessment, arrange truck-aware routing, commercial-use weather access, managed cache/quotas, monitoring and availability targets before taking real fleet traffic.

## Hosted weather rate limit

The hosted API reported `Weather service rate limit reached. Wait before retrying.` during the first live check and again about nine minutes later. Both alternatives had zero complete weather checkpoints; the app correctly withheld a recommendation. This is an upstream rate limit, distinct from the app's own request-budget messages. The public warning does not expose the provider's minute/hour/day reset reason or `Retry-After`, so the reset time is not established.

[Render documents shared outbound IP ranges](https://render.com/docs/outbound-ip-addresses), and an [Open-Meteo discussion](https://github.com/open-meteo/open-meteo/discussions/115) describes shared-IP quotas affecting hosted callers. Shared egress quota is a plausible explanation here, not a confirmed diagnosis of the specific limit. Repeated Compare clicks and service redeploys do not establish that quota has reset; pause provider requests.

If the free endpoint continues to reject normal evaluation traffic after its quota resets, ask Open-Meteo about suitable non-commercial access or use an approved customer account. The [customer API](https://open-meteo.com/en/pricing) requires its customer hostname **and** an `apikey` parameter. The current adapter has no configurable customer API-key parameter, so changing `WEATHER_BASE_URL` alone is insufficient. Add and test server-side key support before configuring customer credentials. No subscription or provider contact has been made.
