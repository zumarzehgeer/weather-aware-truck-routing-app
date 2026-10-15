# Loom walkthrough · approximately 8 minutes

Record yourself after deployment, or use the local app while hosting is being prepared. Keep live and synthetic data clearly identified. Only claim successful provider/deployment checks that you actually performed.

## Five-minute recording for Loom Starter

Loom's [current Starter plan](https://www.atlassian.com/software/loom/pricing) has a five-minute recording limit. Unless the interviewer specifies a different length, aim for **4 minutes 40 seconds**. The longer outline below is available if your plan and assessment instructions allow it.

Before recording, open the deployed application, verify a near-term Chicago–Detroit live trip, and prepare your terminal's actual test output. Keep the app URL visible. Use screen and microphone; include your camera if requested. Start with the site already loaded so a hosting cold start does not consume recording time.

Current deployed URL: **https://weather-aware-truck-routing-app.onrender.com/**. Hosted health, assets, synthetic smoke and desktop/mobile demo checks pass. Hosted Open-Meteo weather was rate-limited during validation; live geocoding/routing worked, but both routes had unknown forecasts and no recommendation.

Prefer resolving that access issue before the final recording. If it persists and the assessment permits a disclosed demo, say: “The application is deployed on Render. Live geocoding and routing work, but the weather provider is currently rate-limiting this deployment. The app shows unknown weather and withholds recommendations. I'll switch to the explicitly labeled synthetic demo to demonstrate the remaining interactions.” Then use the demo for weather/ranking/timeline explanations. Do not describe its forecasts as live. Local live checks succeeded earlier; that does not establish hosted weather readiness.

| Time | Action and narration |
|---|---|
| 0:00–0:25 | “Hi, I'm Zumar. This is Waycast, my Weather-Aware Truck Routing application. It compares alternative routes using forecast weather at each checkpoint's estimated arrival time.” Show the deployed URL. |
| 0:25–1:15 | In Live routes, search/select Chicago and Detroit, choose a departure about one hour ahead with the displayed timezone, 32,000 lb and 25-mile spacing. Compare. “The backend gets real OSRM routes and Open-Meteo forecasts. The provider may return fewer than three alternatives; the app shows what it actually receives.” |
| 1:15–2:00 | Select another route, click a weather checkpoint and open the checkpoint table. “These popups show estimated arrival, wind, rain, snow and the reasons behind the risk category. Checkpoints use edge travel times. Missing weather remains unknown.” |
| 2:00–2:40 | Show route cards and the risk guide. “Each segment uses the higher risk of its endpoint checkpoints. Routes without No Travel or forecast gaps are ranked by Severe miles, High miles, distance-weighted average risk, then duration. Load changes the wind thresholds.” Change load and point out the stale-results message. |
| 2:40–3:15 | Scrub the corridor timeline and toggle layers. “This separate grid contains 49 hourly forecast snapshots. Changing it updates the map locally without changing the arrival-time recommendation or requesting new forecasts.” |
| 3:15–3:40 | Show the mobile layout and one validation message. If using the demo for risk variation, explicitly point out its synthetic label. |
| 3:40–4:20 | Briefly show the source structure and current successful test/build output. “React and TypeScript handle the interface; Django handles validation and orchestration. Provider access, route geometry and risk rules are separate modules. Regression tests cover thresholds, provider errors, cancellation, map interactions and boundary cases.” State test counts only if they match your current output. |
| 4:20–4:40 | “The project is deployed at this URL. The repository includes setup and deployment instructions. This is a planning aid: OSRM's driving profile does not enforce truck road restrictions, and the forecasts do not establish road safety. Thank you.” |

After recording, use Loom's [sharing settings](https://support.atlassian.com/loom/docs/share-your-recording/) to allow the interviewer to view it. If appropriate, choose **Anyone with the link**, then verify the copied link in a signed-out/private browser. Verify the hosted app and GitHub access the same way.

Suggested submission text (replace placeholders before sending):

> Hi [Interviewer name],
>
> I've completed my Weather-Aware Truck Routing assessment, Waycast.
>
> Hosted application: https://weather-aware-truck-routing-app.onrender.com/
>
> Source code: https://github.com/zumarzehgeer/weather-aware-truck-routing-app
>
> Loom walkthrough: [recording URL]
>
> The README covers local setup, architecture, provider limitations and validation.
>
> Best,
> Zumar

If using Render Free, add: “The application may take about a minute to start after inactivity.” Its [free service documentation](https://render.com/docs/free) describes this behavior.

If hosted weather is still rate-limited when submitting, also disclose: “Live geocoding/routing is available, but the hosted weather provider is currently rate-limiting requests. The app displays unknown forecasts rather than recommending an incompletely evaluated route; the labeled synthetic demo remains available.” Remove this note only after confirming a successful hosted live-weather check.

## Longer recording outline

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
