# Loom walkthrough · approximately 8 minutes

Record this yourself after deployment or use the local app. Never imply the demo is live. If the cloud network is still blocked, say that clearly and show the demo plus test evidence; run live verification once access is fixed before claiming a successful live trip.

| Time | Screen / action | Suggested narration |
|---|---|---|
| 0:00–0:45 | Home and trip form | “This is Waycast, my Weather-Aware Truck Routing assessment. It compares weather exposure across up to three routes based on departure, truck load and checkpoint spacing. It uses React/TypeScript, Django, OSRM and Open-Meteo. OSRM’s driving profile does not enforce truck road restrictions.” |
| 0:45–1:40 | Live mode: city searches, timezone, load and spacing | “These are real GeoNames-backed city search results. Departure is interpreted in the selected IANA timezone, converted to UTC server-side, and results display the evaluated zone. Invalid DST times are rejected. I’ll use a near-term Chicago–Detroit trip with a 32,000-pound load and 25-mile checkpoints.” Submit live only when networking works. If not, explain the blocker and click Explore the demo; point to the synthetic label. |
| 1:40–2:40 | Route overview and all alternatives | “All available route lines are visible together. Clicking a route card changes the highlighted line and its checkpoints. The provider is asked for alternatives, but can return fewer than three distinct routes; that gets an explicit message. The demo’s three paths are synthetic fixtures, never a fallback for a failed live request.” |
| 2:40–3:40 | Select a route; open a checkpoint; expand table | “These checkpoint times follow routing edge durations, rather than assuming constant speed. Wind, rain including convective showers, and snow are converted according to the provider’s actual units. The popup gives arrival time, measurements, risk reasons and the chosen hourly forecast. An unknown measurement is shown as unavailable, not zero.” |
| 3:40–4:40 | Risk guide and load edits | “The highest applicable rule wins. Shared rain/snow endpoints choose the higher category while preserving the strict greater-than No Travel thresholds. A load just over 30,000 at 45 mph becomes No Travel; just over 40,000 at 35 mph becomes Severe. Editing inputs marks older results stale until I evaluate again.” |
| 4:40–5:40 | Cards, distance bars, recommendation | “Each interval takes the higher risk of its two endpoint checkpoints. I sum actual segment miles and compute a distance-weighted average on a zero-to-four scale. Eligible routes are ranked by Severe miles, High miles, average risk, then duration. This can favor a longer route. Incomplete routes cannot outrank complete ones, and No Travel routes cannot be recommended.” |
| 5:40–6:35 | Move slider 0→12→24→48; toggle layer | “This grid is a forecast snapshot across the corridor, sampled from weather at each cell center. Its colors use the same risk rules and load. Gray means unknown. It begins at the next UTC hour and has 49 frames. This is independent of the arrival-time weather used in route scoring; moving it does not change the route recommendation or make additional API calls.” |
| 6:35–7:15 | Narrow browser / mobile, checkpoint table, error | “The layout stacks on mobile; forms, route selection, forecast slider and checkpoint details remain usable. Validation, provider outages and rate limits get visible messages. Basemap errors are disclosed without hiding the routes. Search has keyboard selection and a text checkpoint table supplements the map.” |
| 7:15–8:15 | Terminal tests, source and deployment docs | “The backend tests cover thresholds, load rules, conversions, sampling, ETAs, weighted ranking, missing data, validation and API failures. Playwright exercises the real Django demo workflow on desktop and mobile, including popups and the slider. Here are the actual results, the production build, Docker verification and the deployment handoff. The architecture keeps risk rules separate from provider calls. No API keys are shipped to the browser.” |

## Before recording

- [ ] Run setup, backend tests, production build and browser tests; use current output, not an old screenshot.
- [ ] Deploy if account access is available; copy the real HTTPS address only after testing it.
- [ ] Test a live near-term trip after enabling network access. Do not relabel fixtures as live results.
- [ ] Pick a departure within the returned forecast horizon; note the timezone.
- [ ] Have a route with visible risk variation ready. Demo forecast variation depends on departure and load; it is always labeled.
- [ ] Open a checkpoint popup and the text checkpoint table once before recording.
- [ ] Have browser network tools ready to show that slider changes make zero API calls.
- [ ] Show the risk guide, a load change/stale message, and one validation error.
- [ ] Show mobile at about 390px width and all route cards.
- [ ] Keep credentials, deployment settings containing secret values and unrelated tabs out of the recording.
- [ ] End by stating provider/truck restrictions and any remaining live/deployment limitation accurately.

## Demo checklist while recording

- [ ] State whether this run is live or synthetic and show the mode label.
- [ ] Search/select origin and destination (live) or show fixed demo endpoints.
- [ ] Show departure timezone, load in pounds and checkpoint spacing.
- [ ] Compare routes, select each card, and inspect a checkpoint’s arrival-time weather.
- [ ] Explain the recommendation with Severe/High miles and weighted average.
- [ ] Scrub to +48h, show timestamp/legend, toggle forecast and checkpoint layers.
- [ ] Show that the recommendation stays tied to arrival times while the corridor snapshot changes.
- [ ] Change an input and point out stale results; compare again.
- [ ] Demonstrate mobile and one error state.
- [ ] Show actual tests/build/container results and the real hosting status.

Do not submit this assessment or contact the employer automatically.
