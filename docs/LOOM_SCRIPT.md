# Waycast assessment: read-aloud Loom script

Target: about **4 minutes 40 seconds**, including clicks and short pauses. Read the quoted narration; the action notes are for you. Rehearse once and shorten pauses if you approach five minutes. Follow any recording requirements supplied by the interviewer.

Hosted application: https://weather-aware-truck-routing-app.onrender.com/

Repository: https://github.com/zumarzehgeer/weather-aware-truck-routing-app

## Prepare before pressing Record

- Load the hosted site fully before recording. Choose a departure about one hour ahead; check its selected timezone.
- Use Chicago to Detroit, **32,000 lb** and **25-mile** checkpoints. In live mode, select cities from the search suggestions.
- If you choose to recheck live weather during rehearsal, make one comparison and inspect its warnings. The last hosted check was rate-limited; its current status has not been rechecked for this script. Use the matching narration below.
- If weather remains unavailable, use the clearly labeled demo for weather and recommendation interactions. Keep that label visible and acknowledge the limitation. Do not present synthetic results as live data.
- Open the repository in a second tab. Have relevant source files or actual test results ready; do not include secrets or private account settings.
- Practise opening one checkpoint popup, the checkpoint table, Risk guide and the forecast slider. Route counts, risk colors and recommendations can vary; describe the values actually on screen.
- For mobile, use a prepared browser responsive view around 390 pixels wide, or narrow the window. Keep transitions brief.

## 0:00–0:20 — Introduce the application

**Show:** Hosted app and its address bar.

> Hi, I'm Zumar. This is Waycast, my Weather-Aware Truck Routing application for the Spotter AI assessment. It compares alternative routes using forecast weather at the time the truck is expected to reach each checkpoint.

## 0:20–1:05 — Configure a trip and identify the data mode

**Show:** Origin, destination, departure, timezone, load and checkpoint spacing. In live mode, briefly demonstrate a city suggestion. Keep the example at 32,000 lb and 25 miles.

> The form lets me choose an origin and destination, a departure time and timezone, the truck's load, and checkpoint spacing. In live mode, city search uses real geocoding results. The backend converts departure to UTC, while results display the selected timezone. For this example, I'm using Chicago to Detroit, thirty-two thousand pounds, and twenty-five-mile checkpoints.

**Read exactly one of these branches.**

**If live forecasts are complete:** Click Compare routes and show the returned results. If a plan was already loaded during rehearsal, use it and avoid spending recording time on another request.

> These are live results from OSRM routing and Open-Meteo forecasts. The application shows the alternatives the provider actually returns, which may be fewer than three.

**If live weather is still rate-limited:** Briefly show the warning in the live result. Click Demo trip, then Compare demo routes; point to the synthetic-data banner. If no live result is open, explain that the rate limit occurred during your pre-recording check instead of suggesting it is visible.

> Live geocoding and routing work, but the weather provider is currently rate-limiting this deployment. The app shows unknown forecasts and withholds recommendations. I'll use the explicitly labeled synthetic demo to show the remaining interactions.

## 1:05–1:40 — Compare the available routes

**Show:** Route cards and map. Select another route card. Point to the recommendation if one is available; do not promise a particular route wins.

> All available alternatives appear together on the map. Selecting a card highlights that route and its weather checkpoints. Each card shows travel time, distance, arrival time, and miles in each risk category. The recommendation prioritizes fewer Severe miles, then fewer High miles, then distance-weighted average risk, and finally travel time. The fastest route does not automatically win.

## 1:40–2:15 — Inspect checkpoint weather

**Show:** Click a selected route's checkpoint, read one visible measurement, close the popup and expand Arrival-time checkpoints.

> Each checkpoint shows its estimated arrival time, wind speed, rainfall, snowfall, and the reasons for its risk level. Arrival estimates follow the route's edge travel times, rather than assuming one constant speed. Weather is matched to the arrival hour. The table provides the same details in a readable format, including the origin and destination checkpoints.

## 2:15–2:50 — Explain risk and load handling

**Show:** Open Risk guide, point to its weather/load rules, then close it. Change load to **45,000** and show the stale-results notice. Recalculate only if needed for your demonstration; you can leave the notice visible briefly and explain the existing evaluated values.

> The highest applicable weather or load rule determines checkpoint risk. For example, a load over thirty thousand pounds can turn wind in the Severe band into No Travel. Each segment uses the higher risk of its two endpoint checkpoints. Routes with missing forecasts or No Travel conditions are excluded from recommendation. Changing an input marks the existing results as stale until I compare again.

## 2:50–3:25 — Explore the forecast timeline

**Show:** Move the slider to approximately +12h, +24h and +48h. Point to the changing forecast timestamp. Toggle Forecast layer off and on.

> This timeline is a separate view of weather across the route corridor. It contains forty-nine hourly snapshots, starting at the next full UTC hour. Cell colors use weather at representative grid locations and the evaluated load. Moving the slider updates the existing data locally, without another forecast request. It does not change the arrival-time analysis or the route recommendation.

## 3:25–3:45 — Show mobile and validation

**Show:** Switch to the prepared mobile/narrow view. Briefly show the stacked layout. Enter **-1** for load and click Compare to show validation; restore **32,000** afterward. This invalid submission does not call live providers.

> The layout adapts to mobile, including the map, route cards, and checkpoint table. Invalid inputs receive a clear message. Provider failures also remain visible, and unavailable weather is never treated as calm conditions.

## 3:45–4:20 — Explain architecture and verification

**Show:** Repository, then briefly show `providers.py`, `geometry.py` and `risk.py`, or actual test output. Avoid reading code line by line.

> The frontend uses React and TypeScript with Leaflet. Django handles validation and trip planning. Provider access, route sampling, and risk classification are separate modules, which makes them easier to test. I added regression coverage for risk boundaries, malformed provider responses, cancellation, and map interactions. The repository also includes automated browser tests, a Docker setup, CI, and deployment documentation.

**Optional:** If you show matching test output, replace the regression sentence with: “The verified review run passed one hundred and twenty backend tests, six frontend unit tests, and twelve desktop and mobile browser tests.” These are historical review counts; do not imply you just reran them if you did not.

## 4:20–4:40 — Close

**Show:** Return to the hosted application, preferably the route comparison.

> The application is deployed on Render, with setup and architecture details in the README. It is a planning aid: OSRM's driving routes do not enforce truck-specific road restrictions, and forecasts do not establish road safety. Thank you for reviewing my assessment.

## After recording

- Watch the full recording once. Check audio, legibility, data-mode disclosure and whether the spoken claims match the screen.
- Title: **Waycast | Spotter AI Full Stack Developer Assessment | Zumar**.
- Set the viewing access appropriate for the interviewer, copy the link and test it in a signed-out/private browser.
- Include the hosted URL, repository URL and Loom URL in the submission. If hosted live weather remains limited, disclose that explicitly.
- Recording and interviewer submission are user actions; this script does not record, upload or send anything.
