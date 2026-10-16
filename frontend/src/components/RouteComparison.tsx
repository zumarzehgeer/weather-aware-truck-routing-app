import {
  Check,
  ChevronRight,
  Gauge,
  Info,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  Waves,
} from 'lucide-react'
import { riskColors, routeColors } from '../constants'
import type { Plan, Route } from '../types'
import { displayTime, duration, value } from '../utils/format'

function RouteCard({
  route,
  index,
  selected,
  recommended,
  zone,
  onSelect,
}: {
  route: Route
  index: number
  selected: boolean
  recommended: boolean
  zone: string
  onSelect: () => void
}) {
  const summary = route.summary
  return (
    <button
      type="button"
      className={`route-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Select ${route.name}`}
    >
      <div className="route-card-top">
        <span className="route-name">
          <i style={{ background: routeColors[index] }} />
          {route.name}
        </span>
        {recommended ? (
          <span className="recommended-badge">
            <Sparkles size={11} />
            Recommended
          </span>
        ) : summary.no_travel ? (
          <span className="no-travel-badge">No Travel</span>
        ) : !summary.complete ? (
          <span className="unknown-badge">Incomplete</span>
        ) : (
          <span className="alternative-badge">Alternative</span>
        )}
      </div>
      <div className="route-duration">
        {duration(route.duration_seconds)}
        <span>{Math.round(route.distance_miles).toLocaleString()} mi</span>
      </div>
      <p className="arrival">Arrival {displayTime(route.arrival, zone, true)}</p>
      <div className="risk-bar" aria-label="Distance by risk category">
        {Object.entries(summary.risk_miles).map(
          ([name, miles]) =>
            miles > 0 && (
              <span
                title={`${name}: ${miles.toFixed(1)} miles`}
                key={name}
                style={{
                  width: `${(miles / route.distance_miles) * 100}%`,
                  background: riskColors[name],
                }}
              />
            ),
        )}
      </div>
      <div className="route-metrics">
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
        <p className="card-warning">
          No Travel conditions: {summary.risk_miles['No Travel'].toFixed(1)} mi
        </p>
      )}
      {!summary.complete && (
        <p className="card-warning">Forecast gaps · excluded from recommendation</p>
      )}
      <div className="route-card-footer">
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
  )
}

type RouteComparisonProps = {
  plan: Plan | null
  selected: string | null
  zone: string
  onSelect: (id: string) => void
}

export function RouteComparison({ plan, selected, zone, onSelect }: RouteComparisonProps) {
  return (
    <section className="route-comparison" aria-label="Route comparison">
      <div className="alternatives-heading">
        <div>
          <h2>{plan ? 'Your route comparison' : 'Route comparison'}</h2>
          <p>
            {plan
              ? `Evaluated for ${plan.load_lb.toLocaleString()} lb · ${plan.spacing_miles}-mile checkpoints · ${displayTime(plan.departure, zone, true)}`
              : 'Your alternatives will appear here.'}
          </p>
        </div>
        {plan && <span className="route-count">{plan.routes.length} routes</span>}
      </div>
      {plan ? (
        <>
          <div className="route-cards">
            {plan.routes.map((route, index) => (
              <RouteCard
                key={route.id}
                route={route}
                index={index}
                selected={selected === route.id}
                recommended={plan.recommended_id === route.id}
                zone={zone}
                onSelect={() => onSelect(route.id)}
              />
            ))}
          </div>
          <div className={`recommendation ${!plan.recommended_id ? 'unavailable' : ''}`}>
            <span className="recommendation-icon">
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
        <div className="comparison-empty">
          <span className="comparison-empty-icon">
            <RouteIcon size={26} />
          </span>
          <h3>A clearer choice for every trip.</h3>
          <p>
            Compare your trip to see the travel time and weather exposure of each available route.
          </p>
          <div className="comparison-features">
            <span>
              <Gauge size={17} />
              Travel time and distance
            </span>
            <span>
              <Waves size={17} />
              Wind, rain and snow
            </span>
            <span>
              <ShieldCheck size={17} />
              Risk-based recommendation
            </span>
          </div>
          <small>Up to three distinct alternatives, based on provider availability.</small>
        </div>
      )}
    </section>
  )
}
