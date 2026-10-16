import {
  ArrowDownUp,
  ArrowRight,
  CalendarDays,
  Compass,
  Info,
  LoaderCircle,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Truck,
  Wind,
} from 'lucide-react'
import { chicago, detroit, timezones } from '../constants'
import type { TripPlanner } from '../hooks/useTripPlanner'
import { PlaceSearch } from './PlaceSearch'

type TripSidebarProps = { planner: TripPlanner; onOpenGuide: () => void }

export function TripSidebar({ planner, onOpenGuide }: TripSidebarProps) {
  const {
    origin,
    destination,
    placeRevision,
    zone,
    departure,
    load,
    spacing,
    demo,
    loading,
    error,
    demoEnabled,
    errorRef,
    setOrigin,
    setDestination,
    setPlaceRevision,
    setZone,
    setDeparture,
    setLoad,
    setSpacing,
    setDemo,
    changed,
    compare,
  } = planner
  return (
    <aside className="sidebar">
      <section className="form-card">
        <div className="section-title">
          <span className="section-icon">
            <Compass size={18} />
          </span>
          <h2>Plan your trip</h2>
        </div>
        <div className="mode-switch" aria-label="Data mode">
          <button
            type="button"
            className={!demo ? 'active' : ''}
            onClick={() => {
              setDemo(false)
              changed()
            }}
            disabled={loading}
          >
            Live routes
          </button>
          <button
            type="button"
            className={demo ? 'active' : ''}
            onClick={() => {
              setDemo(true)
              setOrigin(chicago)
              setDestination(detroit)
              changed()
            }}
            disabled={loading || !demoEnabled}
          >
            Demo trip
            <Sparkles size={12} />
          </button>
        </div>
        {demo && (
          <p className="demo-form-note">
            Synthetic Chicago → Detroit example.
            <br />
            No live routing or weather is used.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            compare()
          }}
          noValidate
        >
          <div className="places">
            <PlaceSearch
              key={`origin-${placeRevision}`}
              id="origin"
              label="Origin"
              place={origin}
              onChange={(p) => {
                setOrigin(p)
                changed()
              }}
              disabled={demo || loading}
            />
            <button
              type="button"
              className="swap-button"
              aria-label="Swap origin and destination"
              disabled={demo || loading}
              onClick={() => {
                setOrigin(destination)
                setDestination(origin)
                setPlaceRevision((n) => n + 1)
                changed()
              }}
            >
              <ArrowDownUp size={14} />
            </button>
            <PlaceSearch
              key={`destination-${placeRevision}`}
              id="destination"
              label="Destination"
              place={destination}
              onChange={(p) => {
                setDestination(p)
                changed()
              }}
              disabled={demo || loading}
            />
          </div>
          <p className="field-hint">City & town search · not street addresses</p>
          <div className="form-divider" />
          <label htmlFor="departure">
            <CalendarDays size={14} />
            Departure date & time
          </label>
          <input
            type="datetime-local"
            id="departure"
            value={departure}
            onChange={(e) => {
              setDeparture(e.target.value)
              changed()
            }}
            disabled={loading}
            required
          />
          <label htmlFor="timezone" className="compact-label">
            Departure timezone
          </label>
          <select
            id="timezone"
            value={zone}
            onChange={(e) => {
              setZone(e.target.value)
              changed()
            }}
            disabled={loading}
          >
            {Array.from(new Set([...timezones, origin?.timezone ?? '', zone]))
              .filter(Boolean)
              .map((z) => (
                <option value={z} key={z}>
                  {z.replaceAll('_', ' ')}
                </option>
              ))}
          </select>
          <p className="field-hint">
            Time is interpreted in this zone. All results show the evaluated trip’s timezone.
          </p>
          <label htmlFor="load">
            <Truck size={14} />
            Truck load weight
          </label>
          <div className="input-unit">
            <input
              id="load"
              type="number"
              min="0"
              max="120000"
              step="1"
              value={load}
              onChange={(e) => {
                setLoad(e.target.value)
                changed()
              }}
              disabled={loading}
              required
            />
            <span>lb</span>
          </div>
          <label htmlFor="spacing">
            <SlidersHorizontal size={14} />
            Weather checkpoint spacing
          </label>
          <div
            className="spacing-control"
            id="spacing"
            role="group"
            aria-label="Weather checkpoint spacing"
          >
            {[10, 25, 50].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={spacing === n}
                className={spacing === n ? 'active' : ''}
                onClick={() => {
                  setSpacing(n)
                  changed()
                }}
                disabled={loading}
              >
                {n} <span>mi</span>
              </button>
            ))}
          </div>
          <p className="field-hint">Smaller intervals give more weather detail.</p>
          {error && (
            <div className="form-error" role="alert" ref={errorRef} tabIndex={-1}>
              <Info size={17} />
              <span>{error}</span>
            </div>
          )}
          <button type="submit" className="compare-button" disabled={loading}>
            {loading ? (
              <>
                <LoaderCircle size={17} className="spin" />
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
        <p className="form-footnote">
          <ShieldCheck size={13} />
          Weather evaluated at each checkpoint's arrival
        </p>
      </section>
      <div className="driver-note">
        <span className="section-icon">
          <Wind size={19} />
        </span>
        <h3>Load changes wind risk.</h3>
        <p>
          Your load changes how wind risk is classified. We apply the supplied rules at every
          weather checkpoint.
        </p>
        <button type="button" onClick={() => onOpenGuide()}>
          Understand the risk model
          <ArrowRight size={13} />
        </button>
      </div>
      <div className="provider-disclaimer">
        <Info size={15} />
        <p>
          Planning aid only. Driving routes do not include truck road restrictions, live traffic, or
          rest breaks. Always check official advisories.
        </p>
      </div>
    </aside>
  )
}
