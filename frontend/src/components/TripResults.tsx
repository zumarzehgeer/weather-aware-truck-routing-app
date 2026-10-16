import { Info, Sparkles } from 'lucide-react'
import type { TripPlanner } from '../hooks/useTripPlanner'
import { displayTime } from '../utils/format'
import { CheckpointTable } from './CheckpointTable'
import { ForecastTimeline } from './ForecastTimeline'
import { RouteComparison } from './RouteComparison'
import { TripMap } from './map/TripMap'

export function TripResults({ planner }: { planner: TripPlanner }) {
  const {
    plan,
    selected,
    hour,
    loading,
    dirty,
    displayZone,
    demoEnabled,
    resultsRef,
    setSelected,
    setHour,
    compare,
  } = planner
  return (
    <div className="results-column" ref={resultsRef}>
      <div className="results-status">
        {plan?.mode === 'demo' && (
          <div className="demo-banner">
            <Sparkles size={15} />
            <span>
              <strong>Demo mode</strong> · Synthetic routes and forecasts for interaction testing.
              Not a live trip.
            </span>
          </div>
        )}
        {dirty && plan && (
          <div className="stale-banner" role="status">
            <Info size={16} />
            Inputs changed. Map and results still show the last evaluated trip. Compare again to
            update.
          </div>
        )}
        {plan && plan.warnings.length > 0 && (
          <div className="plan-warnings" role="status">
            {plan.warnings.map((warning) => (
              <p key={warning}>
                <Info size={15} />
                {warning}
              </p>
            ))}
          </div>
        )}
      </div>
      <div className="results-workspace">
        <div className="map-column">
          <TripMap
            plan={plan}
            selected={selected}
            onSelect={setSelected}
            hour={hour}
            zone={displayZone}
            loading={loading}
            demoEnabled={demoEnabled}
            onDemo={() => {
              if (demoEnabled) compare(true)
            }}
          />
          <ForecastTimeline plan={plan} hour={hour} zone={displayZone} onHourChange={setHour} />
        </div>
        <RouteComparison
          plan={plan}
          selected={selected}
          zone={displayZone}
          onSelect={setSelected}
        />
      </div>
      {plan && (
        <>
          <CheckpointTable
            route={plan.routes.find((route) => route.id === selected)}
            zone={displayZone}
          />
          <p className="data-attribution">
            {plan.mode === 'demo' ? (
              'Synthetic demonstration data'
            ) : (
              <>
                <a href="https://project-osrm.org/" target="_blank" rel="noreferrer">
                  OSRM
                </a>{' '}
                driving routes ·{' '}
                <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                  Weather data by Open-Meteo.com
                </a>{' '}
                (CC BY 4.0) · GeoNames place search
              </>
            )}{' '}
            · Generated {displayTime(plan.generated_at, displayZone, true)} · ETA excludes breaks &
            live traffic
          </p>
        </>
      )}
    </div>
  )
}
