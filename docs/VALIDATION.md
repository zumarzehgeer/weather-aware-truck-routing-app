# Validation summary

Results below are dated observations, not guarantees of ongoing provider availability.

## Hosted-weather hotfix · 16 October 2026

A fresh hosted Chicago–Detroit check reproduced two valid routes with no available arrival forecasts. The weather adapter previously allowed three concurrent outbound requests, while the provider now documents one concurrent request per IP. The first hotfix, commit `a7f9723`, serializes requests, retries only brief concurrency rejections, honors `Retry-After`, and pauses after quota rejections. GitHub CI passed and Render deployed it. Its more precise warning then confirmed a **daily weather quota rejection** from the hosted server; concurrency changes alone did not restore forecasts.

The follow-up uses browser-assisted public forecasts on Render. Django owns trip preparation, routes and risk evaluation; browser weather is bounded, validated, untrusted input used only for its prepared trip. The local production build completed a real Chicago–Detroit comparison through prepare → browser Open-Meteo fetches → server evaluation: **two complete routes, zero Unknown route miles, Route A recommended, 49 corridor frames**. The only warning disclosed that OSRM returned two alternatives. The live CLI smoke check also passed through the new transport. Direct CORS access from the hosted page's origin returned HTTP 200 before deployment.

Regression verification: **144 backend tests, 6 frontend unit tests and 25 desktop/phone browser tests passed**, with one intentional duplicate layout check skipped. Coverage includes one-use/expired preparation tokens, server-owned trip inputs, malformed/failed weather remaining Unknown, quota pauses, cache reuse and startup health-check recovery. Build, static collection, Django checks and formatters passed. Interactive local checks covered route switching, timeline changes, map layers and a 390px layout with no horizontal overflow.

Hosted verification of the browser-assisted deployment is recorded after release below. Provider quotas still apply; application code does not reset them.

## Structure and readability verification · 16 October 2026

After separating UI components, the trip-state hook, styles, request validation and provider adapters:

- Backend suite: **120 passed**. Frontend unit suite: **6 passed**.
- Desktop/phone browser suites: **21 passed**, with one intentional duplicate mobile check skipped.
- Production TypeScript/Vite build, Django system checks, static collection, Black and Prettier checks: **passed**.
- Built-app smoke check on a fresh Django server: **passed** for health, frontend assets, three synthetic routes, complete arrival forecasts and 49 corridor frames. The temporary server was stopped afterward.
- Python AST comparison confirmed that extracted provider functions and validation retained their original logic, and risk/geometry calculations were unchanged.

Tests are grouped by feature, with shared fixtures separated from test cases. CI also checks consistent formatting. This refactor did not recheck hosted provider availability.

### Final code review and Playwright recheck

The review compared the complete working tree, including new untracked modules, against pre-refactor commit `f868124`. The Standards and Spec passes finished with **zero remaining findings**. One minor style-ownership observation was resolved by moving search dropdown rules to `trip-form.css`, weather popup rules to `map.css`, and result scrolling to `results.css`.

After that correction, the 120 backend tests, 6 unit tests, 21 browser tests (one intentional duplicate skipped), production build, Django checks, static collection, formatter checks and fresh built-app smoke check passed again.

The visible Playwright MCP browser also completed a real local Chicago–Detroit trip at 50-mile spacing: two distinct routes, all 14 arrival checkpoints complete, and Route A recommended. Route switching, checkpoint popups/table, layer toggles, guide focus, stale-label preservation and recalculation passed. Timeline exploration made no additional API requests and preserved arrival-time scores. At 320px, the popup remained within the map after its pan/fade completed, closed through its normal button, and the page had no horizontal overflow. The browser console had zero errors or warnings. These results apply to the local application; the hosted deployment was not rechecked.

## Local verification · 16 October 2026

| Check | Last recorded result |
|---|---|
| Backend regression suite | **120 passed** on native Windows / Python 3.13. CI and Docker target Python 3.12. |
| Frontend unit suite | **6 passed**. |
| Production TypeScript / Vite build | **Passed**. |
| Django system checks and static collection | **Passed**. |
| Chromium desktop / phone suite | **21 passed**, with one intentionally skipped duplicate mobile invocation of the multi-width test. |
| Interactive Playwright MCP | Route selection, checkpoint and corridor popups, layer toggles, timeline, keyboard search, guide focus, input validation and phone layouts passed; browser console had zero errors. |
| Live local Chicago–Detroit | Real geocoding and two distinct OSRM alternatives (about 281 and 298 miles). All 14 arrival checkpoints at 50-mile spacing had complete Open-Meteo forecasts; Route A was recommended. No synthetic fallback. |
| Actual local basemap | Geographic OpenStreetMap tiles verified in the interactive browser. |

Browser regressions cover city-search cancellation and keyboard reopening, clearing old suggestions on mode changes, repeated validation focus, popup access at narrow widths, and viewport widths from 320 to 1440 pixels. A pending-request check verified that double-clicking Compare sends one request, locks inputs, preserves evaluated labels, and resets the timeline after completion. Input edits correctly mark the last evaluated results stale.

A separate synthetic walkthrough demonstrated the load rule: at Route B checkpoint 7, 44 mph wind was High for 32,000 lb and Severe for 45,000 lb. Recalculation moved 100 route miles from High to Severe. The +48h corridor snapshot changed independently of arrival-time route scores. These are synthetic examples, not live-weather evidence.

Automated browser tests use the real Django demo endpoint and controlled provider-failure fixtures. Basemap requests are suppressed in that suite. These tests establish behavior under those inputs; actual provider access and tile content are checked separately. Backend tests cover thresholds, conversion, edge timing, interval aggregation, ranking, DST/input boundaries, malformed providers, rate limiting, caching and concurrency.

## Hosted verification · 15 October 2026

URL: [weather-aware-truck-routing-app.onrender.com](https://weather-aware-truck-routing-app.onrender.com/).

| Check | Last recorded result |
|---|---|
| Render Docker deployment | Succeeded for commit `f32f764`. |
| HTTPS health and frontend assets | **Passed**. |
| Synthetic smoke and desktop / phone interactions | **Passed**; three alternatives and 49 corridor frames. |
| Live geocoding and routing | **Passed**; two distinct OSRM alternatives. |
| Live weather | **Rate-limited**; zero complete arrival forecasts, visible warning and no recommendation. A retry about nine minutes later was also rate-limited. |
| Actual hosted basemap | Not established by the automated hosted run, which suppressed tile requests. |

Hosted live weather and the deployment of subsequent UI changes have not been reconfirmed in this record. A successful local trip does not imply that the hosted provider quota has reset. Before claiming a release is live-ready, deploy the intended commit and repeat the smoke and browser checks in the [deployment guide](DEPLOYMENT.md).

## Reproduce

See [README verification commands](../README.md#verification). Backend, unit and browser suites plus the production build run in GitHub Actions. For an existing local server, set `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173`; otherwise the browser suite starts its own Django server on port 8000 after a frontend build. Live smoke checks are separate and consume provider quota.
