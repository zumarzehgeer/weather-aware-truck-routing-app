# Third code review · 15 October 2026

Latest follow-up: the [fourth review](CODE_REVIEW_FOURTH_PASS.md) adds a P1 basemap defect and records successful live routing/weather checks after network access became active. All ten findings remain open.

Result: **nine open findings**, comprising the eight previously reported issues plus one additional P3 display defect. No additional P1/P2 defect was established in this pass. Application code, dependencies and tests were left unchanged.

## Additional finding

### 9. [P3] Normalize rounded minutes before formatting route durations

Location: `frontend/src/types.ts:24`; used by route cards at `frontend/src/App.tsx:21`.

The formatter floors the hours independently and rounds the remaining seconds into minutes. In the final 30 seconds before an hour boundary, the minute component becomes 60 without carrying into the hour component.

Reproduced against the freshly compiled source helper:

| Input | Current output | Normalized output at the existing minute precision |
|---:|---|---|
| 3,599 seconds | `0h 60m` | `1h 0m` |
| 7,199 seconds | `1h 60m` | `2h 0m` |
| 21,599 seconds | `5h 60m` | `6h 0m` |

These are ordinary routing-provider duration values. The route cards therefore sometimes show a non-normalized travel duration. The defect affects presentation; ranking and ETA calculations use the original numeric values.

Suggested fix: round the total duration to minutes first, then compute hours with integer division by 60 and minutes with modulo 60. Include hour-rollover cases when adding formatter coverage.

## Consolidated open findings

| ID | Priority | Finding | Source |
|---|---|---|---|
| 1 | P2 | Malformed provider payload shapes escape as HTTP 500 | `backend/routing/providers.py:47,143,179` |
| 2 | P2 | A caller-provided cancellation signal bypasses the request deadline | `frontend/src/api.ts:5` |
| 3 | P2 | Swapping an unresolved place leaves displayed text inconsistent with selected state | `frontend/src/PlaceSearch.tsx:16`, `frontend/src/App.tsx:97` |
| 4 | P2 | OSRM HTTP 400 `NoRoute` becomes 502 provider-unavailable | `backend/routing/providers.py:31,90` |
| 5 | P2 | Very large JSON integers overflow numeric validation and return HTTP 500 | `backend/routing/views.py:61,66` |
| 6 | P3 | Demo-disabled deployments retain an enabled Explore button that does nothing | `frontend/src/App.tsx:116`, `frontend/src/TripMap.tsx:93` |
| 7 | P2 | The coarse corridor fallback generates out-of-bounds forecast centers | `backend/routing/geometry.py:84` |
| 8 | P2 | Endpoint markers cover weather risk colors and intercept checkpoint popup clicks | `frontend/src/TripMap.tsx:87` |
| 9 | P3 | Duration formatting can produce a 60-minute component without carrying the hour | `frontend/src/types.ts:24` |

Source inspection confirms the earlier eight fixes have not been applied. Their reproductions and proposed corrections are recorded in the [first review](CODE_REVIEW.md) and [second review](CODE_REVIEW_SECOND_PASS.md); this pass does not claim those issues were repaired.

## Additional integration checks

Exercised the real Django planning endpoint through the HTTPX response layer, with explicit controlled OSRM and Open-Meteo responses. These checks use no real provider requests or synthetic-to-live fallback:

1. **Complete Low forecasts:** three distinct provider routes, sustained wind converted from km/h, valid precipitation unit conversion, zero distance-weighted risk, and recommendation of the shortest-duration eligible route. Passed.
2. **Every route No Travel:** wind supplied as 88.51392 km/h, converted to exactly 55 mph; all routes marked No Travel and `recommended_id` null. Passed.
3. **Arrival outside returned weather series:** weather stays unknown, average risk is null, routes are incomplete, and no recommendation is made. Passed.
4. **Repeated requests:** each scenario initially makes one routing call and two weather batch calls. Repeating the same trip makes zero additional provider calls. Passed.
5. **Distance totals:** risk-category miles sum to each route's distance in all three scenarios. Passed.

These are one-off review checks, not newly added automated tests and not live-provider validation.

## Verification in this pass

| Check | Result |
|---|---|
| Existing backend suite | **62 passed**, 3.22 seconds |
| Django system check | Passed, no issues |
| TypeScript + Vite production build | Passed |
| Existing desktop/mobile Playwright suite | **8 passed**, 18.0 seconds |
| Controlled HTTPX-to-Django planning scenarios | Passed as described above |
| Duration boundary reproduction | Confirmed the P3 finding above |

Rechecked risk and geometry code, provider and validation boundaries, React input/map state, request lifecycle, deployment/startup/CI configuration, dependency declarations, tests, and relevant setup/deployment documentation. No new defect was established in the supplied risk thresholds, distance weighting, recommendation priority or the tested cache-reuse behavior.

Live routing, geocoding, weather and basemap availability remain unverified: the managed environment still reports an enforced empty custom network allowlist. Browser tests use explicit demo/provider fixtures. Docker configuration was inspected; no new Docker build, deployment, environment configuration change, Git commit/push or assessment submission was performed.
