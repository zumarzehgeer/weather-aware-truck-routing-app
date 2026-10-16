# Validation record

## Interactive Playwright MCP verification · 16 October 2026

These checks supersede the earlier local interface counts below. The configured Playwright MCP opened the locally running Vite app at `http://127.0.0.1:5173/` in its browser; the temporary browser launcher is no longer needed.

- **21 Chromium browser tests passed** on the latest follow-up verification, with one intentionally skipped duplicate of the multi-width test. Desktop and phone coverage includes map/route selection, endpoint popups, forecast scrubbing without API calls, layers, validation, failed providers, incomplete/No Travel exclusions, keyboard city search, guide focus, mode-switch suggestion resets, and widths from 320 to 1440 pixels.
- **120 backend tests and 6 frontend unit tests passed** on the follow-up verification. The production TypeScript/Vite build, Django system checks, and static collection passed. Pytest reported a non-failing warning that its existing cache directory was not writable; all backend assertions passed.
- Interactive testing found and repaired guide focus loss on dismissal, city suggestions failing to reopen with arrow keys, and phone popup obstruction/clipping. Map fits now stop previous camera motion and apply immediately, preventing a fit/popup panning race. Each repair has a browser regression check.
- A second interactive pass found that consecutive submissions producing the same validation message did not restore focus, because React batched the unchanged error value. Focus now also follows the submission attempt; repeated empty/excessive loads regain focus without sending requests. Both desktop and phone regression cases pass. The MCP browser reconfirmed keyboard route selection and ordinary popup/guide close-button access at 320px.
- Another MCP pass found that Live → Demo → Live could show suggestions from an earlier search under a reset city (for example, Denver suggestions under Chicago). Selected-place changes now abort old searches and clear cached suggestions, active options, loading/errors, and dropdown state. Regression cases cover both origin and destination on desktop and phone. Delayed search responses did not overwrite a newer query. A controlled pending demo request also verified single submission on double click, locked inputs, unchanged evaluated labels, guide continuity, and a reset forecast hour after completion. Route changes closed old checkpoint popups, and an open corridor popup followed timeline changes without altering arrival risk.
- **Live local Chicago–Detroit trip passed** at 50-mile spacing: real geocoding selected Chicago; OSRM supplied two distinct alternatives (about 281 and 298 miles), all **14 arrival checkpoints** had complete Open-Meteo forecasts, and Route A was recommended. The UI disclosed that the provider returned two routes. No synthetic fallback was used.
- The MCP browser also verified 390px and 320px popups using ordinary close-button clicks, actual geographic tiles, the independent +48h timeline, and focus restoration from all guide openers. Its console reported **zero errors**.
- The live desktop screenshot is saved locally under `.playwright-mcp/waycast-live-desktop.png`. This is local verification; the hosted Render weather limitation below has **not** been rechecked, and these changes have not been pushed or deployed.

## Local interface redesign · 16 October 2026

The Spotter-inspired navy/turquoise interface is implemented locally. Routing, risk classification, and provider adapters were not changed.

- Production TypeScript/Vite build: **passed**.
- Frontend unit tests: **6 passed**.
- Playwright Chromium: **13 passed**, with the duplicate mobile invocation of the multi-width desktop test intentionally skipped. Covers existing desktop/mobile workflows, provider warnings above the map, the wide comparison rail, stacked phone cards, and no page overflow at 1440, 1024, 820, 390, and 320 pixels. Narrow-screen basemap warning and attribution overlap was found and repaired.
- Django system check and static collection: **passed**. Manrope font files and its license are included in the static build.
- Visual checks: geographic OpenStreetMap tiles, empty/demo states, wide layout, phone route cards, and the horizontally scrollable risk-guide table checked in the local browser. Automated tests suppress basemap requests and use synthetic data or explicit failure fixtures.
- Live weather was **not rechecked**; the hosted provider limitation below remains the last recorded result. This redesign has not been pushed or deployed.

## Public Render deployment · 15 October 2026

URL: **https://weather-aware-truck-routing-app.onrender.com/**. The user's Render screenshot shows deploy succeeded/live for commit **`f32f764`**, with Gunicorn listening on Render's injected port. This deployment used the manual Docker Web Service flow rather than creating a Blueprint.

| Hosted check | Actual result |
|---|---|
| HTTPS health / frontend assets | **Passed** through TLS-verified smoke requests. Health reports `status=ok`, `demo_enabled=true`. |
| Synthetic smoke | **Passed**: three alternatives, complete synthetic arrival forecasts, 49 corridor frames; recommendation `r3`. |
| Live geocoding and routes | **Passed**: real Chicago/Detroit results and two distinct OSRM alternatives. |
| Live weather / recommendation | **Not ready**: warning `Weather service rate limit reached. Wait before retrying.` Both routes have 13 checkpoints and **0 complete** arrival forecasts. `recommended_id=null`; corridor still has 49 frames with unknown weather. The live smoke correctly fails its forecast-completeness assertion. |
| Delayed live recheck | Still rate-limited at **19:42 IST** (`2026-10-15T14:12:41Z`), about nine minutes after the earlier diagnostic. Further provider retries were stopped. Exact provider quota/reset is unknown. |
| Hosted desktop / mobile UI | **Passed**: public page, explicitly labeled synthetic demo, alternative selection, both endpoint weather popups, +48h timeline without API calls, no horizontal overflow and no page errors. Tiles were deliberately suppressed; these checks do not establish hosted basemap availability. |
| Loom / employer submission | **Not recorded or sent**. Script updated to disclose the hosted weather limitation if it persists. |

These hosted results are separate from the successful live-provider checks previously performed on the local machine. Shared Render outbound IP quota is a plausible explanation for the cloud-only rate limit, not a verified cause. See [deployment diagnosis and options](DEPLOYMENT.md#hosted-weather-rate-limit). No application behavior was changed to replace failed live data with synthetic data.

## Current local repair validation · 15 October 2026

The original ten findings have been repaired. The [repair review](CODE_REVIEW_FIXES.md) records the review loop and additional boundary/concurrency fixes. Current checks ran on native Windows with **Python 3.13.14**, **Node 24.18.0** and Playwright Chromium. Python 3.12 remains the CI/container target; it was not installed locally. These results supersede the open-finding status below; earlier evidence is retained as history.

| Current check | Actual result |
|---|---|
| Backend tests | **120 passed**, including provider shapes, numeric/date limits, shared concurrency, boundary grids and UTC forecast lookup. |
| Frontend unit tests | **6 passed**: caller cancellation, deadlines with caller signal, already-aborted calls, response-body timeout, cleanup and duration rounding. |
| TypeScript / Vite build | **Passed**. |
| Django system check / collected assets | **Passed**. |
| Desktop/mobile Playwright | **12 passed**, including real clicks on both endpoint checkpoints, location swap and disabled demo controls. Tiles are deliberately aborted. |
| Synthetic smoke | **Passed**: three routes, complete arrival forecasts, 49 corridor frames. |
| Live smoke | **Passed**: real geocoding, two OSRM route alternatives, complete Open-Meteo arrival forecasts, 49 corridor frames; recommendation `r1`. TLS verification retained. |
| Actual basemap content | One standard OSM tile (`7/33/47`) fetched with TLS verification and identifying User-Agent/Referer; HTTP 200 PNG, 26,062 bytes. Visually inspected: roads, cities and Lake Michigan, with no key-required placeholder. SHA-256 `def2428ee6bc749466d965e9b2685e894502e9988c8a0efb80736f1e4a14350b`. No bulk download. |
| Docker | **Not rerun**: local Docker engine is not running. |
| Public hosting / recording / submission at local repair time | Not performed at that stage; the subsequent public deployment is recorded above. Recording/submission remain pending. |

Initial browser rerun had a popup assertion race while Leaflet's prior popup faded out; assertions now wait for removal. The subsequent full run passed. Dependencies were installed with TLS verification; no application secrets or generated assets are committed.

## Historical cloud validation

Run on **15 October 2026** in the previous managed cloud environment. Source was built from an empty repository; no pre-existing application files were replaced. No public deployment, commit/push, employer contact or submission was performed during those checks.

The [fourth review](CODE_REVIEW_FOURTH_PASS.md) verified live APIs after network access became active, but found that CARTO's default basemap served API-key-required placeholders. Its ten findings were open at that time and are repaired by the current local changes.

| Check | Actual result |
|---|---|
| `bash scripts/setup.sh` | Passed after making npm/pip caches use writable temporary paths. Reinstalled from unchanged pins/lockfile, built frontend, collected matching assets and checked Django. |
| `.venv/bin/pytest -q` | **62 passed**. No skipped or expected-failure tests in the final run. |
| `npm run build` in frontend | Passed TypeScript strict checking and Vite production build. Final bundle about **414 kB JS / 127 kB gzip**, **42.4 kB CSS / 12.9 kB gzip**. |
| Django system check | No issues. |
| Playwright with system Chromium | **8 passed**, four workflows each on desktop (1440px) and mobile (390px), latest run 17.6 seconds. |
| Visual inspection | Desktop and mobile full-page screenshots inspected. No horizontal document overflow. Demo labels remain visible. |
| Docker multi-stage build | Passed with TLS verification and a temporary trusted CA mount; runtime image tagged `waycast:assessment`. A name-based Docker lint warning flags the non-secret boolean `DJANGO_REQUIRE_SECRET`; no credential value is embedded. |
| Docker production smoke | Passed health, frontend assets, labeled demo plan, three alternatives, complete arrival-time forecasts and 49 corridor frames. Runtime runs as non-root `app`, via Gunicorn/WhiteNoise. |
| Live OSRM, Open-Meteo geocoding and weather | **Passed in this instance** after the allowlist became active: real Chicago–Detroit search and planning returned two distinct routes, complete arrival-time forecasts and 49 corridor frames. Live desktop/mobile route selection, interior checkpoint popup and slider checks also passed. |
| Live basemap | **Failed visual validation**: the default CARTO URL returns HTTP 200 PNGs reading “API KEY REQUIRED,” not geographic map tiles. TLS-verified downloads confirmed this independently. Headless Chromium also has a separate proxy-CA trust limitation; verified tile responses were relayed for visual inspection without disabling TLS. |
| Public hosting | **Not deployed**. No configured hosting capability, runtime credential binding, outbound identity or target account was available. Docker and Render handoff included. |

## Browser checks actually exercised

- Load home, explicitly enter the real Django synthetic-demo workflow, and render all three route cards.
- Select an alternative and open a real Leaflet checkpoint popup with ETA, measurements, units and risk reasons.
- Move the slider to +48h; verify its timestamp **and cell colors change**, while **zero API requests** occur.
- Hide/show the corridor and checkpoints; verify the layers disappear **and reappear**, then fit all routes.
- Open/close the risk guide with the keyboard and check the mobile layout for horizontal overflow.
- Search with a controlled geocoding response; select using arrow/Enter keys.
- Validate bad load/unfinished place selection; show loading and explicit provider rate-limit/error messages.
- Render controlled incomplete/No Travel results without a recommendation, and mark results stale when inputs change.
- Show empty city-search results and a place-provider failure.

Tests use explicitly controlled provider responses and the labeled Django demo. They establish application behavior under those inputs; they do not establish successful access to live weather, routing, geocoding or tiles.

Separately, the fourth pass exercised actual live APIs and desktop/mobile interactions. Selecting routes, opening an interior checkpoint and scrubbing to +48h made no additional API calls and preserved arrival-time route summaries. These one-off live checks are recorded in the latest review; they do not replace the automated suite or resolve the basemap and other open findings.

## Problems found and fixed during verification

- Binary conversion dust could put exact converted precipitation boundaries in a lower risk category. Conversion now rounds to ten decimals; boundary regression tests cover it.
- Fresh frontend assets could differ from Django’s collected asset manifest. Startup/test setup now collects after building and starts a fresh server.
- A delayed search blur could hide a newly focused search’s error. Blur closes synchronously; result buttons preserve input focus.
- Separate full-size canvas panes intercepted lower-layer clicks. Interactive paths use SVG; checkpoint popups are exercised by real browser clicks.
- Reusing a removed checkpoint pane could lose its renderer, and React-Leaflet Pane styles only apply on initialization. Panes are retained where appropriate, visibility/order update through the supported DOM ref, and browser tests assert layer reappearance.
- Zero-distance starting edges could shift the origin ETA. Origin/final checkpoints now explicitly use departure/provider total duration.
- Cloud home cache paths are read-only. Setup uses writable cache directories without disabling integrity/TLS checks.
- Files copied into a non-root image initially retained restrictive source ownership. Source/assets/start script now copy with the runtime UID/GID, and the container smoke passes as `app`.

## Remaining actions

1. Resolve or disclose hosted Open-Meteo rate limiting; after a suitable pause, a successful live smoke is required before claiming hosted live weather works.
2. Check actual hosted basemap content and exercise the deployed live route popups/slider once forecasts are available.
3. Commit/push the deployment documentation when ready; preserve the user's independent local source edits. The application repairs are already deployed at `f32f764`.
4. Record the [walkthrough](WALKTHROUGH.md), accurately distinguishing live and synthetic data and any unresolved hosted-provider limitation, then verify recording-link access before submitting the assessment.
