# Fourth code review · 15 October 2026

Result: **ten open findings: one P1, seven P2 and two P3**. The nine earlier findings remain present in the source. This pass establishes one additional high-priority basemap defect using actual provider responses and visual inspection. Application code, dependencies and tests were left unchanged; only review/validation documentation was updated.

## 10. [P1] Default basemap URL returns API-key-required placeholders

Location: `frontend/src/TripMap.tsx:60`; failure notice logic at line 62.

The default tile URL is `https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`, without an API key. CARTO now requires a key for raster basemaps. Actual requests return **HTTP 200 `image/png`** containing only an **“API KEY REQUIRED”** message. The map therefore shows repeated placeholder images behind the routes and forecasts, rather than roads, cities or terrain. Because the images load successfully, Leaflet's `tileerror` event does not fire and the application's basemap-unavailable notice is absent.

Evidence from this review:

- Requests for distinct tiles `7/33/47` and `7/33/48` both returned status 200, 2,513-byte PNGs, with the same SHA-256: `cc3f31364a735d9a8179af36b3db7617cdff8bdb0248654ebcc3df91607abedc`.
- Inspected the returned image and full desktop/mobile application screenshots. The tiles visibly say “API KEY REQUIRED”; they are not usable geographic map content.
- The [official CARTO basemap repository README](https://github.com/CartoDB/basemap-styles#readme), fetched during review, states **“An API key is required to use CARTO basemaps”**, specifies `?key=YOUR_KEY`, and explains that requests without a key receive an “API key required” watermark.
- Current application configuration has neither a map-provider key requirement nor a way to add the required query parameter. The README's earlier blanket claim that no API key is needed for the entire workflow was therefore inaccurate and has been corrected.

Suggested fix: configure valid access for a provider whose terms permit this application, or select a suitable policy-compliant provider that supports the intended no-key workflow. Keep any secret credential server-side and follow the chosen provider's rules for browser-visible credentials. Do not disable TLS verification or pretend the placeholder images are valid maps. Add provider-aware configuration validation and a visual check of actual basemap content; HTTP status, image MIME type and `naturalWidth > 0` are insufficient.

This is high priority because the assessment explicitly emphasizes a working geographic map. Route geometry and weather analysis remain functional, but they do not restore the missing basemap.

## Live validation now possible

The environment's custom network allowlist is now active and enforced. This is a meaningful change from the earlier reviews, where live access was blocked.

Actual results:

| Check | Outcome |
|---|---|
| Open-Meteo geocoding | HTTP 200; real Chicago and Detroit search results selected in the browser. |
| Open-Meteo weather | HTTP 200; 168 forecast hours; actual units handled correctly, including `mp/h` wind and inch precipitation/snowfall. |
| OSRM routing | HTTP 200; two distinct Chicago–Detroit routes, full geometry and aligned edge distance/duration annotations. |
| `scripts/smoke.py --live` against this instance | Passed health, frontend assets, live plan, two routes, complete arrival forecasts and 49 corridor frames; recommended `r1`. |
| Desktop live application interaction | Passed real search, comparison, two-route disclosure, route selection, an interior checkpoint popup and +48h slider interaction; no page errors. |
| Mobile live application interaction | Same functional checks passed at the mobile viewport, with no horizontal document overflow and no page errors. |
| Slider behavior | Zero additional API calls and unchanged arrival-time route summaries while moving the forecast snapshot to +48h. |
| Actual basemap appearance | **Failed**: API-key-required placeholders, despite successful image downloads. |

These live checks use actual API data and preserve the UI's `live` mode. No routing/weather responses were replaced with demo fixtures.

### Browser certificate limitation, kept separate from the application defect

This cloud headless Chromium instance rejects the session proxy CA on direct tile requests (`ERR_CERT_AUTHORITY_INVALID`). A normal HTTPX request using the provided proxy and trusted CA succeeds with TLS verification enabled. For visual inspection, the browser harness used Playwright's TLS-verified request client (`route.fetch()`), then forwarded those exact tile responses to the page. No certificate verification was disabled and no replacement tile content was generated.

The relay allowed 10 tile images on desktop and 9 on mobile to render in the final viewport, making the key-required placeholders visible. The direct Chromium CA-trust issue is a test-environment limitation. The placeholder content is a separate provider/configuration defect that persists even with correctly verified downloads.

The one-off browser harness's transport/interactions assertions passed, but its successful-image assertion **did not validate the basemap content**. Visual inspection caught that gap. The existing automated browser suite deliberately aborts map tiles and cannot catch this provider requirement.

## Consolidated findings

| ID | Priority | Open issue | Source |
|---|---|---|---|
| 10 | P1 | Unauthenticated CARTO tiles are key-required placeholders | `frontend/src/TripMap.tsx:60` |
| 1 | P2 | Malformed provider payload shapes escape as HTTP 500 | `backend/routing/providers.py:47,143,179` |
| 2 | P2 | Caller cancellation signal bypasses request deadline | `frontend/src/api.ts:5` |
| 3 | P2 | Swapping unresolved places leaves misleading field text | `frontend/src/PlaceSearch.tsx:16`, `frontend/src/App.tsx:97` |
| 4 | P2 | OSRM HTTP 400 `NoRoute` becomes 502 provider-unavailable | `backend/routing/providers.py:31,90` |
| 5 | P2 | Huge JSON integers overflow request validation | `backend/routing/views.py:61,66` |
| 7 | P2 | Coarse corridor centers can exceed valid longitude bounds | `backend/routing/geometry.py:84` |
| 8 | P2 | Endpoint markers cover weather risk colors and consume popup clicks | `frontend/src/TripMap.tsx:87` |
| 6 | P3 | Demo-disabled mode leaves an enabled no-op Explore button | `frontend/src/App.tsx:116`, `frontend/src/TripMap.tsx:93` |
| 9 | P3 | Rounded route duration can contain `60m` without an hour carry | `frontend/src/types.ts:24` |

Earlier evidence and proposed fixes remain in the [first](CODE_REVIEW.md), [second](CODE_REVIEW_SECOND_PASS.md) and [third](CODE_REVIEW_THIRD_PASS.md) reports. They are historical review records; their network-blocked observations have been superseded by this pass's live evidence.

## Other checks

- Existing backend suite: **62 passed**, 3.24 seconds.
- Existing desktop/mobile Playwright suite: **8 passed**, 17.6 seconds.
- TypeScript + Vite production build: **passed**.
- Django system check: **passed**, no issues.
- Source review rechecked provider/validation boundaries, risk and geometry logic, React/map state, request lifecycle, startup/deployment configuration and documented requirements.
- No additional defect was established in the supplied weather/load thresholds, distance weighting or lexicographic ordering during this pass.

No new Docker build, environment configuration save, Git commit/push, public deployment or employer contact/submission was performed. Fix the basemap and the earlier findings before claiming the application is ready for assessment delivery.
