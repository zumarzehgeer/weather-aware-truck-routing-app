# Validation summary

Results below are dated observations, not guarantees of ongoing provider availability.

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
