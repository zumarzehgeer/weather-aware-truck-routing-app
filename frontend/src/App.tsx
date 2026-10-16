import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownUp,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CloudSun,
  Compass,
  Gauge,
  Info,
  LoaderCircle,
  Route as RouteIcon,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Truck,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import { PlaceSearch } from './PlaceSearch';
import { TripMap } from './TripMap';
import { api } from './api';
import { chicago, detroit, displayTime, duration, riskColors, routeColors, value } from './types';
import type { Place, Plan, Route } from './types';

const zones = [
  'America/Chicago',
  'America/New_York',
  'America/Denver',
  'America/Los_Angeles',
  'America/Detroit',
  'UTC',
  'Europe/London',
  'Asia/Kolkata',
];
function localDate(zone: string) {
  const date = new Date(Date.now() + 3600_000);
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return parts.replace(' ', 'T');
}

function RouteCard({
  route,
  index,
  selected,
  recommended,
  zone,
  onSelect,
}: {
  route: Route;
  index: number;
  selected: boolean;
  recommended: boolean;
  zone: string;
  onSelect: () => void;
}) {
  const summary = route.summary;
  return (
    <button
      type='button'
      className={`route-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Select ${route.name}`}
    >
      <div className='route-card-top'>
        <span className='route-name'>
          <i style={{ background: routeColors[index] }} />
          {route.name}
        </span>
        {recommended ? (
          <span className='recommended-badge'>
            <Sparkles size={11} />
            Recommended
          </span>
        ) : summary.no_travel ? (
          <span className='no-travel-badge'>No Travel</span>
        ) : !summary.complete ? (
          <span className='unknown-badge'>Incomplete</span>
        ) : (
          <span className='alternative-badge'>Alternative</span>
        )}
      </div>
      <div className='route-duration'>
        {duration(route.duration_seconds)}
        <span>{Math.round(route.distance_miles).toLocaleString()} mi</span>
      </div>
      <p className='arrival'>Arrival {displayTime(route.arrival, zone, true)}</p>
      <div className='risk-bar' aria-label='Distance by risk category'>
        {Object.entries(summary.risk_miles).map(
          ([name, miles]) =>
            miles > 0 && (
              <span
                title={`${name}: ${miles.toFixed(1)} miles`}
                key={name}
                style={{ width: `${(miles / route.distance_miles) * 100}%`, background: riskColors[name] }}
              />
            ),
        )}
      </div>
      <div className='route-metrics'>
        <span>
          Severe
          <b>
            {value(summary.risk_miles.Severe)} <small>mi</small>
          </b>
        </span>
        <span>
          High
          <b>
            {value(summary.risk_miles.High)} <small>mi</small>
          </b>
        </span>
        <span>
          Avg. risk
          <b>
            {summary.average_risk === null ? 'Unknown' : summary.average_risk.toFixed(2)}
            <small>{summary.average_risk !== null ? ' / 4' : ''}</small>
          </b>
        </span>
      </div>
      {summary.no_travel && (
        <p className='card-warning'>No Travel conditions: {summary.risk_miles['No Travel'].toFixed(1)} mi</p>
      )}
      {!summary.complete && <p className='card-warning'>Forecast gaps · excluded from recommendation</p>}
      <div className='route-card-footer'>
        {selected ? (
          <>
            <Check size={13} />
            Selected on map
          </>
        ) : (
          <>
            View route
            <ChevronRight size={14} />
          </>
        )}
      </div>
    </button>
  );
}

function Guide({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className='guide-dialog'
      aria-labelledby='risk-guide-title'
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className='guide-inner'>
        <button type='button' className='dialog-close' aria-label='Close risk guide' onClick={onClose}>
          <X size={20} />
        </button>
        <h2 id='risk-guide-title'>Weather risk, explained.</h2>
        <p>Each checkpoint uses the highest applicable condition, including the supplied load rules.</p>
        <div className='table-scroll'>
          <table>
            <thead>
              <tr>
                <th>Risk</th>
                <th>Wind mph</th>
                <th>Rain in/h</th>
                <th>Snow in/h</th>
              </tr>
            </thead>
            <tbody>
              {['Low', 'Moderate', 'High', 'Severe', 'No Travel'].map((label, i) => (
                <tr key={label}>
                  <th>
                    <i style={{ background: riskColors[label] }} />
                    {label}
                  </th>
                  <td>{['<25', '25–<35', '35–<45', '45–<55', '≥55'][i]}</td>
                  <td>{['<0.10', '0.10–<0.25', '0.25–<0.50', '0.50–1.00', '>1.00'][i]}</td>
                  <td>{['<0.5', '0.5–<1.0', '1.0–<2.0', '2.0–3.0', '>3.0'][i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Load changes the wind rule</h3>
        <p>
          45–&lt;55 mph and a load over 30,000 lb means No Travel. 35–&lt;45 mph and a load over 40,000 lb means Severe.
          Wind ≥55 mph means No Travel at every load.
        </p>
        <h3>How we compare routes</h3>
        <p>
          Each interval inherits the higher risk of its two endpoints. Miles are summed by category, and averaged on a
          0–4 scale (Low 0, Moderate 1, High 2, Severe 3, No Travel 4). Unknown endpoints make the interval unknown
          unless No Travel is already known.
        </p>
        <p>
          Fully evaluated routes without No Travel conditions are ranked by Severe miles, then High miles, then
          distance-weighted average, then travel time. Unknown data never counts as low risk.
        </p>
        <h3>Two views of the forecast</h3>
        <p>
          Route cards and checkpoint dots use weather at estimated arrival. The 0–48h corridor layer is an independent
          hourly snapshot, beginning at the next UTC hour. Its colors show the same weather/load risk at grid-cell
          centers; it is not radar or a continuous observation.
        </p>
        <p className='guide-disclaimer'>
          OSRM driving routes do not consider truck height, weight limits, hazardous cargo, road closures, rest breaks,
          or live traffic. Weather forecasts and this supplied model do not establish road safety. Check official
          advisories and commercial truck navigation.
        </p>
      </div>
    </dialog>
  );
}

export default function App() {
  const [origin, setOrigin] = useState<Place | null>(chicago);
  const [destination, setDestination] = useState<Place | null>(detroit);
  const [placeRevision, setPlaceRevision] = useState(0);
  const [zone, setZone] = useState('America/Chicago');
  const [departure, setDeparture] = useState(() => localDate('America/Chicago'));
  const [load, setLoad] = useState('32000');
  const [spacing, setSpacing] = useState(25);
  const [demo, setDemo] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hour, setHour] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submissionAttempt, setSubmissionAttempt] = useState(0);
  const [guide, setGuide] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [displayZone, setDisplayZone] = useState(zone);
  const [demoEnabled, setDemoEnabled] = useState(true);
  const errorRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const activeRequest = useRef(false);
  useEffect(() => {
    api<{ demo_enabled: boolean }>('/api/health')
      .then((data) => setDemoEnabled(data.demo_enabled))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error, submissionAttempt]);
  function changed() {
    if (plan) setDirty(true);
  }
  async function compare(useDemo = demo) {
    if (activeRequest.current) return;
    // Re-focus repeated validation messages even when React batches the same error value.
    setSubmissionAttempt((attempt) => attempt + 1);
    setError('');
    const from = useDemo ? chicago : origin,
      to = useDemo ? detroit : destination;
    if (!from || !to) {
      setError('Select an origin and destination from the city search results.');
      return;
    }
    if (load.trim() === '' || !Number.isFinite(Number(load)) || Number(load) < 0 || Number(load) > 120000) {
      setError('Enter a load between 0 and 120,000 lb.');
      return;
    }
    if (!departure) {
      setError('Choose a departure date and time.');
      return;
    }
    activeRequest.current = true;
    setLoading(true);
    if (useDemo) {
      setDemo(true);
      setOrigin(chicago);
      setDestination(detroit);
    }
    try {
      const result = await api<Plan>('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: from,
          destination: to,
          departure_local: departure,
          timezone: zone,
          load_lb: Number(load),
          spacing_miles: spacing,
          demo: useDemo,
        }),
      });
      setPlan(result);
      setSelected(result.recommended_id ?? result.routes[0].id);
      setHour(0);
      setDirty(false);
      setDisplayZone(zone);
      if (window.innerWidth < 900) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to compare routes. Try again.');
    } finally {
      activeRequest.current = false;
      setLoading(false);
    }
  }
  return (
    <>
      <header className='app-header'>
        <a href='/' className='brand' aria-label='Waycast home'>
          <span className='brand-mark'>
            <RouteIcon size={24} strokeWidth={2.2} />
          </span>
          <span>
            waycast<span className='brand-dot'>.</span>
          </span>
          <span className='brand-divider' />
          <span className='brand-descriptor'>
            Weather-aware routing
          </span>
        </a>
        <div className='header-actions'>
          <span className='header-context'><Compass size={15} />Route planner</span>
          <button type='button' onClick={() => setGuide(true)}>
            <Info size={16} />
            Risk guide
          </button>
        </div>
      </header>
      <main className='workspace'>
        <div className='page-intro'>
          <div>
            <h1>Weather-aware route planning</h1>
            <p>See the conditions ahead. Compare the miles that matter.</p>
          </div>
          <div className='intro-note'>
            <CloudSun size={31} strokeWidth={1.3} />
            <span>
              Arrival-time weather
              <strong>48-hour corridor outlook</strong>
            </span>
          </div>
        </div>
        <div className='workspace-grid'>
          <aside className='sidebar'>
            <section className='form-card'>
              <div className='section-title'>
                <span className='section-icon'>
                  <Compass size={18} />
                </span>
                <h2>Plan your trip</h2>
              </div>
              <div className='mode-switch' aria-label='Data mode'>
                <button
                  type='button'
                  className={!demo ? 'active' : ''}
                  onClick={() => {
                    setDemo(false);
                    changed();
                  }}
                  disabled={loading}
                >
                  Live routes
                </button>
                <button
                  type='button'
                  className={demo ? 'active' : ''}
                  onClick={() => {
                    setDemo(true);
                    setOrigin(chicago);
                    setDestination(detroit);
                    changed();
                  }}
                  disabled={loading || !demoEnabled}
                >
                  Demo trip
                  <Sparkles size={12} />
                </button>
              </div>
              {demo && (
                <p className='demo-form-note'>
                  Synthetic Chicago → Detroit example.
                  <br />
                  No live routing or weather is used.
                </p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  compare();
                }}
                noValidate
              >
                <div className='places'>
                  <PlaceSearch
                    key={`origin-${placeRevision}`}
                    id='origin'
                    label='Origin'
                    place={origin}
                    onChange={(p) => {
                      setOrigin(p);
                      changed();
                    }}
                    disabled={demo || loading}
                  />
                  <button
                    type='button'
                    className='swap-button'
                    aria-label='Swap origin and destination'
                    disabled={demo || loading}
                    onClick={() => {
                      setOrigin(destination);
                      setDestination(origin);
                      setPlaceRevision((n) => n + 1);
                      changed();
                    }}
                  >
                    <ArrowDownUp size={14} />
                  </button>
                  <PlaceSearch
                    key={`destination-${placeRevision}`}
                    id='destination'
                    label='Destination'
                    place={destination}
                    onChange={(p) => {
                      setDestination(p);
                      changed();
                    }}
                    disabled={demo || loading}
                  />
                </div>
                <p className='field-hint'>City & town search · not street addresses</p>
                <div className='form-divider' />
                <label htmlFor='departure'>
                  <CalendarDays size={14} />
                  Departure date & time
                </label>
                <input
                  type='datetime-local'
                  id='departure'
                  value={departure}
                  onChange={(e) => {
                    setDeparture(e.target.value);
                    changed();
                  }}
                  disabled={loading}
                  required
                />
                <label htmlFor='timezone' className='compact-label'>
                  Departure timezone
                </label>
                <select
                  id='timezone'
                  value={zone}
                  onChange={(e) => {
                    setZone(e.target.value);
                    changed();
                  }}
                  disabled={loading}
                >
                  {Array.from(new Set([...zones, origin?.timezone ?? '', zone]))
                    .filter(Boolean)
                    .map((z) => (
                      <option value={z} key={z}>
                        {z.replaceAll('_', ' ')}
                      </option>
                    ))}
                </select>
                <p className='field-hint'>
                  Time is interpreted in this zone. All results show the evaluated trip’s timezone.
                </p>
                <label htmlFor='load'>
                  <Truck size={14} />
                  Truck load weight
                </label>
                <div className='input-unit'>
                  <input
                    id='load'
                    type='number'
                    min='0'
                    max='120000'
                    step='1'
                    value={load}
                    onChange={(e) => {
                      setLoad(e.target.value);
                      changed();
                    }}
                    disabled={loading}
                    required
                  />
                  <span>lb</span>
                </div>
                <label htmlFor='spacing'>
                  <SlidersHorizontal size={14} />
                  Weather checkpoint spacing
                </label>
                <div className='spacing-control' id='spacing' role='group' aria-label='Weather checkpoint spacing'>
                  {[10, 25, 50].map((n) => (
                    <button
                      key={n}
                      type='button'
                      aria-pressed={spacing === n}
                      className={spacing === n ? 'active' : ''}
                      onClick={() => {
                        setSpacing(n);
                        changed();
                      }}
                      disabled={loading}
                    >
                      {n} <span>mi</span>
                    </button>
                  ))}
                </div>
                <p className='field-hint'>Smaller intervals give more weather detail.</p>
                {error && (
                  <div className='form-error' role='alert' ref={errorRef} tabIndex={-1}>
                    <Info size={17} />
                    <span>{error}</span>
                  </div>
                )}
                <button type='submit' className='compare-button' disabled={loading}>
                  {loading ? (
                    <>
                      <LoaderCircle size={17} className='spin' />
                      Checking the road ahead…
                    </>
                  ) : (
                    <>
                      Compare {demo ? 'demo ' : ''}routes
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
              <p className='form-footnote'>
                <ShieldCheck size={13} />
                Weather evaluated at each checkpoint's arrival
              </p>
            </section>
            <div className='driver-note'>
              <span className='section-icon'>
                <Wind size={19} />
              </span>
              <h3>Load changes wind risk.</h3>
              <p>
                Your load changes how wind risk is classified. We apply the supplied rules at every weather checkpoint.
              </p>
              <button type='button' onClick={() => setGuide(true)}>
                Understand the risk model
                <ArrowRight size={13} />
              </button>
            </div>
            <div className='provider-disclaimer'>
              <Info size={15} />
              <p>
                Planning aid only. Driving routes do not include truck road restrictions, live traffic, or rest breaks.
                Always check official advisories.
              </p>
            </div>
          </aside>
          <div className='results-column' ref={resultsRef}>
            <div className='results-status'>
              {plan?.mode === 'demo' && (
                <div className='demo-banner'>
                  <Sparkles size={15} />
                  <span>
                    <strong>Demo mode</strong> · Synthetic routes and forecasts for interaction testing. Not a live trip.
                  </span>
                </div>
              )}
              {dirty && plan && (
                <div className='stale-banner' role='status'>
                  <Info size={16} />
                  Inputs changed. Map and results still show the last evaluated trip. Compare again to update.
                </div>
              )}
              {plan && plan.warnings.length > 0 && (
                <div className='plan-warnings' role='status'>
                  {plan.warnings.map((warning) => <p key={warning}><Info size={15} />{warning}</p>)}
                </div>
              )}
            </div>
            <div className='results-workspace'>
              <div className='map-column'>
                <TripMap
                  plan={plan}
                  selected={selected}
                  onSelect={setSelected}
                  hour={hour}
                  zone={displayZone}
                  loading={loading}
                  demoEnabled={demoEnabled}
                  onDemo={() => {
                    if (demoEnabled) compare(true);
                  }}
                />
                <section className={`forecast-panel ${!plan ? 'disabled' : ''}`} aria-label='Corridor forecast'>
                  <div className='forecast-heading'>
                    <div className='forecast-title'>
                      <span className='section-icon'>
                        <CloudSun size={19} />
                      </span>
                      <div>
                        <h2>Weather along the corridor</h2>
                        <p>Hourly snapshot · independent of your arrival-time analysis</p>
                      </div>
                    </div>
                    <div className='forecast-time'>
                      <span>Forecast at</span>
                      <strong>
                        {plan ? displayTime(plan.corridor.timestamps[hour], displayZone, true) : 'Plan a trip to explore'}
                      </strong>
                    </div>
                  </div>
                  <div className='slider-row'>
                    <span>+{hour}h</span>
                    <input
                      aria-label='Forecast hour'
                      type='range'
                      min='0'
                      max='48'
                      step='1'
                      value={hour}
                      disabled={!plan}
                      onChange={(e) => setHour(Number(e.target.value))}
                    />
                    <span>48h</span>
                  </div>
                  <div className='slider-ticks'>
                    <span>Next full hour</span>
                    <span>+12h</span>
                    <span>+24h</span>
                    <span>+36h</span>
                    <span>+48h</span>
                  </div>
                  <div className='forecast-legend'>
                    <span>Weather risk</span>
                    {Object.entries(riskColors).map(([label, color]) => (
                      <span key={label}>
                        <i style={{ background: color }} />
                        {label}
                      </span>
                    ))}
                  </div>
                </section>
              </div>
              <section className='route-comparison' aria-label='Route comparison'>
                <div className='alternatives-heading'>
                  <div>
                    <h2>{plan ? 'Your route comparison' : 'Route comparison'}</h2>
                    <p>
                      {plan
                        ? `Evaluated for ${plan.load_lb.toLocaleString()} lb · ${plan.spacing_miles}-mile checkpoints · ${displayTime(plan.departure, displayZone, true)}`
                        : 'Your alternatives will appear here.'}
                    </p>
                  </div>
                  {plan && <span className='route-count'>{plan.routes.length} routes</span>}
                </div>
                {plan ? (
                  <>
                    <div className='route-cards'>
                      {plan.routes.map((route, index) => (
                        <RouteCard
                          key={route.id}
                          route={route}
                          index={index}
                          selected={selected === route.id}
                          recommended={plan.recommended_id === route.id}
                          zone={displayZone}
                          onSelect={() => setSelected(route.id)}
                        />
                      ))}
                    </div>
                    <div className={`recommendation ${!plan.recommended_id ? 'unavailable' : ''}`}>
                      <span className='recommendation-icon'>
                        {plan.recommended_id ? <ShieldCheck size={21} /> : <Info size={21} />}
                      </span>
                      <div>
                        <h3>
                          {plan.recommended_id
                            ? `Why ${plan.routes.find((r) => r.id === plan.recommended_id)?.name}?`
                            : 'No route can be recommended'}
                        </h3>
                        <p>{plan.explanation}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className='comparison-empty'>
                    <span className='comparison-empty-icon'><RouteIcon size={26} /></span>
                    <h3>A clearer choice for every trip.</h3>
                    <p>Compare your trip to see the travel time and weather exposure of each available route.</p>
                    <div className='comparison-features'>
                      <span><Gauge size={17} />Travel time and distance</span>
                      <span><Waves size={17} />Wind, rain and snow</span>
                      <span><ShieldCheck size={17} />Risk-based recommendation</span>
                    </div>
                    <small>Up to three distinct alternatives, based on provider availability.</small>
                  </div>
                )}
              </section>
            </div>
            {plan && (
              <>
                <details className='checkpoint-details'>
                  <summary>
                    Arrival-time checkpoints · {plan.routes.find((r) => r.id === selected)?.name}
                    <span>View weather details</span>
                  </summary>
                  <div className='table-scroll'>
                    <table>
                      <caption>
                        Selected route · all times in {displayZone}. Unknown forecasts are excluded from recommendation.
                      </caption>
                      <thead>
                        <tr>
                          <th>Mile</th>
                          <th>Estimated arrival</th>
                          <th>Risk</th>
                          <th>Wind mph</th>
                          <th>Rain in/h</th>
                          <th>Snow in/h</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.routes
                          .find((r) => r.id === selected)
                          ?.checkpoints.map((point) => (
                            <tr key={point.id}>
                              <td>{point.mile.toFixed(1)}</td>
                              <td>{displayTime(point.arrival, displayZone, true)}</td>
                              <td>
                                <i style={{ background: riskColors[point.risk.label] }} />
                                {point.risk.label}
                              </td>
                              <td>{value(point.weather?.wind_mph)}</td>
                              <td>{value(point.weather?.rain_in, 2)}</td>
                              <td>{value(point.weather?.snow_in, 2)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </details>
                <p className='data-attribution'>
                  {plan.mode === 'demo' ? (
                    'Synthetic demonstration data'
                  ) : (
                    <>
                      <a href='https://project-osrm.org/' target='_blank' rel='noreferrer'>
                        OSRM
                      </a>{' '}
                      driving routes ·{' '}
                      <a href='https://open-meteo.com/' target='_blank' rel='noreferrer'>
                        Weather data by Open-Meteo.com
                      </a>{' '}
                      (CC BY 4.0) · GeoNames place search
                    </>
                  )}{' '}
                  · Generated {displayTime(plan.generated_at, displayZone, true)} · ETA excludes breaks & live traffic
                </p>
              </>
            )}
          </div>
        </div>
        <footer className='app-footer'>
          <span>
            <CloudSun size={16} />
            waycast. <span>Weather-aware truck routing</span>
          </span>
          <button type='button' onClick={() => setGuide(true)}>
            How we calculate risk
            <ArrowRight size={13} />
          </button>
        </footer>
      </main>
      {guide && <Guide onClose={() => setGuide(false)} />}
    </>
  );
}
