import { useRef, useState } from 'react'
import { CircleMarker, MapContainer, Pane, TileLayer, Tooltip, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import { Expand, Layers, MapPin, Route as RouteIcon } from 'lucide-react'
import type { Plan } from '../../types'
import { CheckpointMarkers } from './CheckpointMarkers'
import { ForecastCorridor } from './ForecastCorridor'
import { MapViewport, routeBounds } from './MapViewport'
import { RoutePaths } from './RoutePaths'

export function TripMap({
  plan,
  selected,
  onSelect,
  hour,
  zone,
  loading,
  demoEnabled,
  onDemo,
}: {
  plan: Plan | null
  selected: string | null
  onSelect: (id: string) => void
  hour: number
  zone: string
  loading: boolean
  demoEnabled: boolean
  onDemo: () => void
}) {
  const [heatmap, setHeatmap] = useState(true)
  const [checkpoints, setCheckpoints] = useState(true)
  const [tileError, setTileError] = useState(false)
  const map = useRef<L.Map | null>(null)
  return (
    <div className="map-shell">
      <div className="map-toolbar">
        <div>
          <span className="status-dot" />
          <strong>Trip overview</strong>
          <span className="map-toolbar-sub">
            {plan
              ? `${plan.routes.length} alternative${plan.routes.length === 1 ? '' : 's'} · ${plan.mode === 'demo' ? 'synthetic example' : 'live provider data'}`
              : 'Plan your next journey'}
          </span>
        </div>
        <span className={`map-label ${plan?.mode === 'demo' ? 'demo' : ''}`}>
          {plan?.mode === 'demo'
            ? 'Synthetic demo'
            : plan
              ? 'Live route analysis'
              : 'Weather + routes'}
        </span>
      </div>
      <div className="map-body">
        <MapContainer
          ref={map}
          center={[41.9, -85.2]}
          zoom={7}
          zoomControl={false}
          scrollWheelZoom={false}
          className="trip-map"
          attributionControl
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            referrerPolicy="strict-origin-when-cross-origin"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            eventHandlers={{ tileerror: () => setTileError(true) }}
          />
          <ZoomControl position="bottomright" />
          <MapViewport plan={plan} />
          {plan && <ForecastCorridor plan={plan} hour={hour} visible={heatmap} zone={zone} />}
          {plan && <RoutePaths plan={plan} selected={selected} onSelect={onSelect} />}
          {plan && (
            <CheckpointMarkers plan={plan} selected={selected} visible={checkpoints} zone={zone} />
          )}
          {plan && (
            <Pane name="endpoints" style={{ zIndex: 450, pointerEvents: 'none' }}>
              {[plan.origin, plan.destination].map((place, i) => (
                <CircleMarker
                  key={i}
                  interactive={false}
                  center={[place.latitude, place.longitude]}
                  radius={9}
                  pathOptions={{
                    color: '#fff',
                    weight: 3,
                    fillColor: i ? '#203d44' : '#309d87',
                    fillOpacity: 1,
                  }}
                >
                  <Tooltip permanent direction={i ? 'right' : 'left'} className="endpoint-label">
                    {place.name.split(',')[0]}
                  </Tooltip>
                </CircleMarker>
              ))}
            </Pane>
          )}
        </MapContainer>
        {plan && (
          <div className="layer-controls">
            <button type="button" aria-pressed={heatmap} onClick={() => setHeatmap(!heatmap)}>
              <Layers size={15} />
              Forecast layer
              <span className={`mini-toggle ${heatmap ? 'on' : ''}`} />
            </button>
            <button
              type="button"
              aria-pressed={checkpoints}
              onClick={() => setCheckpoints(!checkpoints)}
            >
              <MapPin size={15} />
              Checkpoints
              <span className={`mini-toggle ${checkpoints ? 'on' : ''}`} />
            </button>
            <button
              type="button"
              className="fit-button"
              aria-label="Fit all routes"
              onClick={() => {
                if (map.current && plan) {
                  map.current.stop()
                  map.current.fitBounds(routeBounds(plan), { padding: [48, 48], animate: false })
                }
              }}
            >
              <Expand size={16} />
            </button>
          </div>
        )}
        {!plan && !loading && (
          <div className="map-empty">
            <span className="map-empty-icon">
              <RouteIcon size={28} />
            </span>
            <h2>See the weather along your route.</h2>
            <p>
              Choose your cities and compare the conditions
              <br />
              at each estimated arrival.
            </p>
            <button type="button" disabled={!demoEnabled} onClick={onDemo}>
              Explore the demo <span>↗</span>
            </button>
            <small>Synthetic Chicago–Detroit example</small>
          </div>
        )}
        {loading && (
          <div className="map-loading">
            <span className="loading-ring" />
            <strong>Looking down the road…</strong>
            <p>Finding routes and checking forecasts along your trip.</p>
          </div>
        )}
        {tileError && (
          <div className="tile-notice">
            Basemap unavailable. Route geometry and forecast overlays remain usable.
          </div>
        )}
        {plan && (
          <div className="map-scale-note">
            {heatmap ? 'Corridor colors: hourly weather + load risk' : 'Forecast layer hidden'}
            <br />
            <span>Route dots: arrival-time risk · Selected route only</span>
          </div>
        )}
      </div>
    </div>
  )
}
