# Validation record

Run on **15 October 2026** in the managed cloud environment. Source was built from an empty repository; no pre-existing application files were replaced. No public deployment, commit/push, employer contact or submission was performed.

Latest update: the [fourth review](CODE_REVIEW_FOURTH_PASS.md) verified live APIs after network access became active, but found that CARTO's default basemap serves API-key-required placeholders. Ten code-review findings remain open; the map is not ready for delivery.

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

1. Fix the CARTO basemap access/configuration issue and the other open review findings, add targeted regressions, and repeat live/visual validation. Network access is now active; the previous provider-network blocker has been cleared in this instance.
2. Review/save the reusable install/start instructions and publish the prepared environment when satisfied. Publication/new-task restoration has not been validated here.
3. Commit/push the application to the intended branch and deploy using [DEPLOYMENT.md](DEPLOYMENT.md) on your own approved hosting account. No paid provisioning is authorized or performed.
4. Run `python3 scripts/smoke.py --base-url https://YOUR-HOST --live`, exercise the deployed map, then add the real HTTPS URL and results here.
5. Record the [walkthrough](WALKTHROUGH.md), accurately distinguishing live and synthetic data, before you submit the assessment yourself.
