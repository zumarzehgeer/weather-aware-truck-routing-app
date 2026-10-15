# Code review · 15 October 2026

Latest follow-up: [second full review](CODE_REVIEW_SECOND_PASS.md) reconfirmed these six findings and added two more. All eight remain open.

Scope: the full application created in this checkout, including Django/provider boundaries, geometry and risk rules, React/Leaflet state, request lifecycle, tests, startup and deployment files. There is no committed baseline: all application files are new and uncommitted. Application source was left unchanged during this review. The confirmed findings below remain open.

## Confirmed findings

### 1. [P2] Malformed provider payloads escape as unhandled HTTP 500

Locations: `backend/routing/providers.py:47`, `:135`, `:143`, `:179`.

Geocoding assumes every result has `.get()`. Weather parsing assumes `hourly_units` is a dictionary. The boundary handlers catch several exceptions, but not `AttributeError`, so structurally invalid JSON can bypass the intended provider error/unknown-forecast behavior.

Reproduced with the real Django request handler and mocked upstream payloads:

- Geocoding `{"results":["invalid-result"]}` produces HTTP **500**, with an HTML response, instead of a controlled JSON 502.
- A forecast with valid hourly arrays but `"hourly_units":[]` raises **AttributeError: 'list' object has no attribute 'get'** from `forecasts()`. Through planning this becomes an unhandled 500 instead of an incomplete plan with unknown weather.

Fix: validate provider object/list/element shapes before reading them. Translate invalid geocoding/routing payloads to `ProviderError`; translate invalid weather payloads to an unknown batch and warning. Avoid a blanket catch that also hides programming errors. Add regressions at the HTTP/provider boundary, including a malformed single-location result in a multi-location response.

### 2. [P2] The search cancellation signal bypasses the request timeout

Locations: `frontend/src/api.ts:3–5`; caller at `frontend/src/PlaceSearch.tsx:23`.

The helper creates and times out its own controller, but `options?.signal ?? timeout.signal` replaces it whenever the caller supplies a signal. Every geocoding request supplies one. If a request stalls while the input stays focused and unchanged, the intended 110-second deadline cannot abort that fetch, leaving the search loading until another event cancels it.

Reproduced against the compiled helper with a controlled pending fetch: after firing the timeout callback, **the signal actually passed to fetch remains un-aborted**. Caller cancellation still works, confirming the two controllers are disconnected.

Fix: combine caller cancellation and timeout signals, and distinguish an intentional caller cancellation from timeout reporting. Add a controlled-clock test that supplies a caller signal and verifies the deadline aborts the actual fetch.

### 3. [P2] Swapping an unresolved place leaves misleading selected-place text

Locations: `frontend/src/App.tsx:97`; `frontend/src/PlaceSearch.tsx:16`.

The swap button permits nullable/unresolved places, but the search component only synchronizes displayed text when the incoming place is non-null. Clearing the origin and swapping moves the selected Detroit object into origin while destination becomes null; destination nevertheless keeps its old Detroit text.

Reproduced in Chromium: **both fields display Detroit**, but Compare reports “Select an origin and destination from the city search results.” A user cannot tell from the visible fields which location is unresolved. Replacing a place with a free-text search before swapping has the same state/text mismatch.

Fix: either disable swapping until both places are selected, or model editable text and selected place together so a swap moves/reset both consistently. Add a browser regression for clearing or partially typing a place before swapping.

### 4. [P2] OSRM HTTP 400 `NoRoute` is misclassified as provider unavailability

Locations: `backend/routing/providers.py:31`, `:90`.

The routing adapter has explicit `NoRoute`/`NoSegment` handling, but the shared HTTP helper raises for non-success status before the adapter can inspect the JSON code. An OSRM error delivered with HTTP 400 therefore never reaches that branch. The current no-route test mocks `get_json`, bypassing this behavior.

Reproduced by mocking the actual HTTPX response with HTTP 400 and `{"code":"NoRoute","message":"Impossible route between points"}`: the adapter returns **502 `provider_unavailable`**, rather than **422 `no_route`**. This tells users to retry/check provider access for a trip that needs different endpoints.

Fix: permit documented OSRM error responses to be parsed in the routing adapter, or map the provider error code before generic HTTP failure translation. Keep genuine malformed responses, authentication failures, timeouts and rate limits distinct. Add tests through the HTTPX response layer, rather than only mocking its parsed output.

### 5. [P2] Large JSON integers crash numeric validation

Locations: `backend/routing/views.py:61`, `:66`, `:101`.

`math.isfinite()` converts integers to a floating-point number before the range check. A valid JSON integer with hundreds of digits raises `OverflowError`; the request handler does not catch that exception. The 16KB body limit does not prevent a 401-digit number.

Reproduced with an otherwise valid plan request and `load_lb = 10**400`: **HTTP 500**, rather than JSON 400. Latitude/longitude use the same validation pattern. This is an unauthenticated API validation defect even though the normal form does not emit such values.

Fix: reject values outside their numeric bounds before floating-point operations, and handle conversion/date-range overflow explicitly. Add API regressions for very large integers and extreme local-date conversion, asserting a structured validation response rather than 500.

### 6. [P3] Disabling demo mode leaves an enabled button that silently does nothing

Locations: `frontend/src/App.tsx:116`; `frontend/src/TripMap.tsx:93`.

The form’s Demo trip control respects `/api/health.demo_enabled`, but the empty-map “Explore the demo” button remains enabled. Its callback silently returns when demo is disabled.

Reproduced in Chromium with health returning `demo_enabled:false`: the mode-switch button is disabled, **Explore the demo remains enabled**, and clicking it produces neither a plan nor an error/status message.

Fix: pass feature availability to the map and hide/disable the action consistently, with an accessible explanation if appropriate. Add a browser case with demo mode disabled.

## Verification performed during this review

| Check | Result |
|---|---|
| Existing backend suite | **62 passed**, 3.24 seconds |
| Django system check | Passed, no issues |
| Frontend TypeScript + Vite production build | Passed |
| Existing desktop/mobile Playwright suite | **8 passed**, 17.3 seconds |
| Additional targeted reproductions | Confirmed all six findings above using Django handlers, the compiled API helper, actual HTTPX responses, and Chromium interactions |

The existing passing suites do not cover the failing cases above. No additional defect was established in the supplied risk thresholds, conservative precipitation endpoints, distance-weighted aggregation, or lexicographic priority order during this pass. That is scoped evidence, not a claim that every live provider behavior has been verified.

Live provider integration and real basemap availability remain unverified because the running cloud network policy still lacks the saved API domains. Browser tests intentionally use explicit fixtures/demo responses; they are not proof of live routing/weather access. The Docker runtime was verified in the implementation pass, but a new Docker build was not needed for this read-only review.

## Environment publish/create banner

The screenshot reports that settings “changed or are in use.” That is a platform publication/precondition error, separate from the six application findings. The banner alone does not distinguish stale settings from an in-use conflict, and the available tools do not expose publication error logs or a publish/unlock operation.

Observed facts:

- The running instance is healthy but still uses an older published configuration.
- Before this review, the draft existed at revision 3 and already contained the required network domains and reusable scripts. No missing secret/environment-variable requirements were declared.
- The current install/start instructions were resaved without changing their contents or other settings; the backend confirmed persistence. A subsequent read verified **draft revision 4**, with the repository and network entries preserved.
- This confirms a fresh saved draft, **not** a successful publish, applied network policy, or released platform lock.

Recovery step: close and reopen environment settings to load revision 4, choose **Save draft**, then **Publish**. If the same banner persists from that freshly loaded page, use its **Report issue** action for the platform conflict; application code cannot repair the publishing service. Do not delete the checkout, reset the draft, remove network requirements or replace credentials as a workaround.

No public hosting deployment, Git push, employer contact or assessment submission was performed. Application code was not changed while reviewing; only this report was added to the checkout.
