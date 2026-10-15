# Local review and repair loop · 15 October 2026

Scope: the complete initial application at `8c8099fa95dd64366e41b8a14031908fec6e1014` and all local repairs. Because history contains one root commit, the initial review used `git diff 4b825dc642cb6eb9a060e54bf8d69288fbee4904 HEAD`; subsequent passes reviewed the working tree against `HEAD`. The original review reports remain historical records.

The code-review skill's Standards and Spec axes ran in separate agents. Available requirements were the README, walkthrough, provider/API contract, previous review evidence and the user's handoff; no separate employer issue/specification was supplied. Critical/important scope was P0/P1/P2. The two original P3 fixes were small and were included.

## Review loop

1. Initial independent Standards/Spec review confirmed the existing P1/P2 findings. Standards additionally reproduced a process-wide weather concurrency violation: two simultaneous plans could issue six batches despite the documented limit of three. Spec identified overflowing local-date timezone conversion.
2. Repaired backend/provider boundaries and frontend interactions, with focused regressions. Independent frontend re-review found no remaining P0/P1/P2. Backend self-review additionally closed deeply nested provider JSON, exact map-edge floating point cells and Windows forecast timestamp boundaries.
3. Independent backend re-review found a remaining finite but extreme route-duration case: rounding an arrival near the end of year 9999 to the next forecast hour could escape as HTTP 500. Forecast lookup now rounds UTC datetimes directly and returns unknown beyond its representable horizon. A full plan-building regression covers the failure.
4. Final cross-review of backend, frontend and configuration found no remaining actionable P0/P1/P2. A final test rerun exposed floating point microsecond variation in the year-9999 regression's exact timestamp assertion; fixing the fixture to whole seconds made the intended boundary deterministic. All final backend tests passed.

## Resolved findings

| Priority | Finding | Repair and regression evidence |
|---|---|---|
| P1 | CARTO returns API-key-required placeholder tiles | Standard OSM HTTPS tiles, visible attribution, normal browser caching and explicit cross-origin referrer policy. Official usage policy reviewed; one actual tile visually confirmed geographic content. |
| P2 | Malformed provider structures cause HTTP 500 | Validate objects, arrays, coordinate ranges, numeric types, units and timestamps. Invalid routing/geocoding produces structured provider errors; invalid weather remains unknown with warnings. |
| P2 | Caller AbortSignal bypasses timeout | Shared controller observes caller cancellation and the deadline through body reading; listeners/timers cleaned up. Node tests cover both paths and already-aborted calls. |
| P2 | Swapping unresolved places displays misleading text | Remount both search fields on swap to synchronize selection and query state; desktop/mobile regressions preserve resolved selection and clear unresolved text. |
| P2 | OSRM HTTP 400 NoRoute becomes availability error | Parse only recognized routing HTTP 400 `NoRoute`/`NoSegment` responses before generic status handling. Actual HTTP-layer regressions verify 422 and preserve other failures. |
| P2 | Huge numeric JSON values cause HTTP 500 | Bounds checks precede float arithmetic. Positive/negative huge load and coordinate integers return structured 400. |
| P2 | Coarse grid generates invalid longitude | Clip cell bounds to the supported extent and use the clipped center. Tests cover both longitude signs, high latitudes, corners, route coverage and recommendation eligibility. |
| P2 | Endpoint markers hide weather colors/popups | Decorative endpoints ignore pointer events below the checkpoint pane. Real desktop/mobile clicks open origin and destination weather popups. |
| P2 | Weather concurrency bound applies per evaluation | Process-wide semaphore limits outbound weather calls to three; synchronized concurrent-plan regression checks the shared bound. |
| P2 | Extreme local dates overflow timezone conversion | Conversion overflow becomes structured validation 400; invalid datetime/timezone shapes and deep request JSON are also covered. |
| P2 | Extreme arrival hour overflows forecast lookup | UTC datetime arithmetic avoids POSIX date limits; unrepresentable next hour becomes unknown weather with no recommendation. Offset-zone and full-plan regressions included. |
| P3 | Durations display 60 remaining minutes | Round total minutes before dividing into hours/minutes; regression covers 3599/7199 seconds. |
| P3 | Disabled demo still has enabled Explore button | Both entry points use server demo availability; desktop/mobile tests assert disabled controls. |
| Minor | Corridor popup displays UTC instead of evaluated timezone | Reuse the evaluated timezone formatter. |

Search keyboard handling also resets the active option after query edits and ignores hidden suggestions on Enter. Playwright's server command now selects and quotes the Windows/Linux virtual-environment executable. CI runs the new Node unit suite.

## Standards

**Final result: 0 remaining actionable P0/P1/P2 findings.** The documented process-wide weather concurrency violation is repaired. Independent review found no consequential baseline smell or functional standards violation in the final changes. Tool-enforced style was excluded.

## Spec

**Final result: 0 remaining actionable P0/P1/P2 findings.** Provider errors, unknown weather, validation, map checkpoint access, location swapping, request deadlines and evaluated timezone behavior now match the available specification. No scope creep finding remained. No separate employer specification was available for comparison.

## Verification and limits

- Backend: **120 passed**; Django system check passed.
- Frontend: TypeScript/Vite production build passed; **6 Node unit tests passed**.
- Browser: **12 desktop/mobile tests passed**, including endpoint popups, swap and disabled demo regressions, layer/timeline behavior and mobile overflow. Tile requests are intentionally aborted in this suite.
- Synthetic smoke: passed with three routes, complete arrival forecasts and 49 frames.
- Live smoke: passed with real geocoding, two route alternatives, complete forecasts and 49 frames; recommended `r1`.
- Basemap: one TLS-verified standard OSM tile visually inspected as roads/place names; see [validation details](VALIDATION.md). This is separate from the automated browser evidence. Follow the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/); no bulk/prefetch test was run.
- Local versions: Windows, Python **3.13.14**, Node **24.18.0**, Playwright Chromium. The Python **3.12** CI/container target was not rerun here; the local Docker daemon is not running.

Zero remaining findings describes the completed review's evidence, not a guarantee that all possible bugs have been eliminated. Public deployment, Loom recording, assessment submission, Git commit and push were not performed. The user's existing `.vscode/` files were preserved.

Final axis counts: **Standards 0 critical/important; Spec 0 critical/important**.
