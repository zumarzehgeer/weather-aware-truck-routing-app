import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Pane, Polyline, Popup, Rectangle, TileLayer, Tooltip, useMap, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import { Expand, Layers, MapPin, Route as RouteIcon } from 'lucide-react'
import { displayTime, riskColors, routeColors, value } from './types'
import type { Plan } from './types'
import type { ReactNode } from 'react'

// React-Leaflet Pane styles are initialization-only. Update mutable layer visibility/order via its DOM ref.
function LayerPane({ name, zIndex, visible = true, children }: { name: string; zIndex: number; visible?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (ref.current) { ref.current.style.zIndex = String(zIndex); ref.current.style.display = visible ? 'block' : 'none' }
  }, [zIndex, visible])
  return <Pane ref={ref} name={name} style={{ zIndex, display: visible ? 'block' : 'none' }}>{children}</Pane>
}

function FitMap({ plan }: { plan: Plan | null }) {
  const map = useMap()
  useEffect(() => {
    if (plan) {
      map.stop()
      map.fitBounds(L.latLngBounds(plan.routes.flatMap(r => r.geometry.map(([lon, lat]) => L.latLng(lat, lon)))), { padding: [48, 48], maxZoom: 10, animate: false })
    }
  }, [plan, map])
  useEffect(() => {
    const element = map.getContainer()
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(element)
    return () => observer.disconnect()
  }, [map])
  return null
}

const Corridor = memo(function Corridor({ plan, hour, visible, zone }: { plan: Plan; hour: number; visible: boolean; zone: string }) {
  return <LayerPane name="forecast-corridor" zIndex={350} visible={visible}>{plan.corridor.cells.map((cell, i) => {
    const snapshot = cell.forecasts[hour]
    return <Rectangle key={i} className="forecast-cell" bounds={cell.bounds} pathOptions={{ stroke: false, fillColor: riskColors[snapshot.risk.label], fillOpacity: 0.3 }}>
      <Popup maxHeight={240} autoPanPaddingTopLeft={[12, 64]} autoPanPaddingBottomRight={[12, 84]}><div className="weather-popup"><span className="popup-eyebrow">Corridor forecast · snapshot</span><strong>{snapshot.risk.label}</strong>
        <p>{displayTime(plan.corridor.timestamps[hour], zone, true)}</p>
        <span>Wind {value(snapshot.weather?.wind_mph)} mph · Rain {value(snapshot.weather?.rain_in, 2)} in/h · Snow {value(snapshot.weather?.snow_in, 2)} in/h</span>
        <small>Cell-center forecast; not arrival-time analysis.</small></div></Popup>
    </Rectangle>
  })}</LayerPane>
})

export function TripMap({ plan, selected, onSelect, hour, zone, loading, demoEnabled, onDemo }: {
  plan: Plan | null; selected: string | null; onSelect: (id: string) => void; hour: number; zone: string; loading: boolean; demoEnabled: boolean; onDemo: () => void
}) {
  const [heatmap, setHeatmap] = useState(true)
  const [checkpoints, setCheckpoints] = useState(true)
  const [tileError, setTileError] = useState(false)
  const map = useRef<L.Map | null>(null)
  const checkpointRenderer = useMemo(() => L.svg({ pane: 'checkpoints' }), [])
  const routePositions = useMemo(() => Object.fromEntries((plan?.routes ?? []).map(route =>
    [route.id, route.geometry.map(([lon, lat]) => [lat, lon] as [number, number])])), [plan])
  const sorted = plan ? [...plan.routes].sort((a, b) => Number(a.id === selected) - Number(b.id === selected)) : []
  return <div className="map-shell">
    <div className="map-toolbar"><div><span className="status-dot" /><strong>Trip overview</strong><span className="map-toolbar-sub">{plan ? `${plan.routes.length} alternative${plan.routes.length === 1 ? '' : 's'} · ${plan.mode === 'demo' ? 'synthetic example' : 'live provider data'}` : 'Plan your next journey'}</span></div>
      <span className={`map-label ${plan?.mode === 'demo' ? 'demo' : ''}`}>{plan?.mode === 'demo' ? 'Synthetic demo' : plan ? 'Live route analysis' : 'Weather + routes'}</span></div>
    <div className="map-body">
      <MapContainer ref={map} center={[41.9, -85.2]} zoom={7} zoomControl={false} scrollWheelZoom={false} className="trip-map" attributionControl>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
          referrerPolicy="strict-origin-when-cross-origin"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ tileerror: () => setTileError(true) }} />
        <ZoomControl position="bottomright" /><FitMap plan={plan} />
        {plan && <Corridor plan={plan} hour={hour} visible={heatmap} zone={zone} />}
        {sorted.map(route => {
          const index = plan!.routes.findIndex(r => r.id === route.id)
          const positions = routePositions[route.id]
          return <LayerPane key={route.id} name={`route-${route.id}`} zIndex={route.id === selected ? 440 : 420}>
            <Polyline positions={positions} pathOptions={{ color: '#0d1e2d', weight: route.id === selected ? 10 : 8, opacity: 0.95 }} interactive={false} />
            <Polyline positions={positions} pathOptions={{ color: routeColors[index], weight: route.id === selected ? 5 : 3, opacity: route.id === selected ? 1 : 0.85, dashArray: route.id === selected ? undefined : '7 5' }} eventHandlers={{ click: () => onSelect(route.id) }}>
              <Tooltip sticky>{route.name}{route.id === plan!.recommended_id ? ' · Recommended' : ''} · Click to select</Tooltip>
            </Polyline>
          </LayerPane>
        })}
        {plan && <Pane name="checkpoints" style={{ zIndex: 460 }}>{checkpoints && plan.routes.find(r => r.id === selected)?.checkpoints.map((point, i) => <CircleMarker key={point.id}
          renderer={checkpointRenderer} className="weather-checkpoint" center={[point.coordinate[1], point.coordinate[0]]} radius={i === 0 ? 7 : 5}
          pathOptions={{ className: 'weather-checkpoint', color: '#163139', weight: 2, fillColor: riskColors[point.risk.label], fillOpacity: 1 }}>
          <Tooltip>Checkpoint {i + 1} · Mile {Math.round(point.mile)} · {point.risk.label}</Tooltip>
          <Popup maxHeight={240} autoPanPaddingTopLeft={[12, 64]} autoPanPaddingBottomRight={[12, 84]}><div className="weather-popup"><span className="popup-eyebrow">{plan.routes.find(r => r.id === selected)?.name} · Checkpoint {i + 1}</span>
            <strong><i style={{ background: riskColors[point.risk.label] }} />{point.risk.label}</strong>
            <p>Mile {point.mile.toFixed(1)} · ETA {displayTime(point.arrival, zone, true)}</p>
            <div className="popup-weather"><span>Wind<b>{value(point.weather?.wind_mph)} <small>mph</small></b></span><span>Rain<b>{value(point.weather?.rain_in, 2)} <small>in/h</small></b></span><span>Snow<b>{value(point.weather?.snow_in, 2)} <small>in/h</small></b></span></div>
            <ul>{point.risk.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
            <small>Hourly forecast: {point.weather ? displayTime(point.weather.time, zone, true) : 'Unavailable'}. Risk uses your trip’s arrival time and load.</small>
          </div></Popup>
        </CircleMarker>)}</Pane>}
        {plan && <Pane name="endpoints" style={{ zIndex: 450, pointerEvents: 'none' }}>{[plan.origin, plan.destination].map((place, i) => <CircleMarker key={i} interactive={false} center={[place.latitude, place.longitude]} radius={9}
          pathOptions={{ color: '#fff', weight: 3, fillColor: i ? '#203d44' : '#309d87', fillOpacity: 1 }}><Tooltip permanent direction={i ? 'right' : 'left'} className="endpoint-label">{place.name.split(',')[0]}</Tooltip></CircleMarker>)}</Pane>}
      </MapContainer>
      {plan && <div className="layer-controls"><button type="button" aria-pressed={heatmap} onClick={() => setHeatmap(!heatmap)}><Layers size={15} />Forecast layer<span className={`mini-toggle ${heatmap ? 'on' : ''}`} /></button>
        <button type="button" aria-pressed={checkpoints} onClick={() => setCheckpoints(!checkpoints)}><MapPin size={15} />Checkpoints<span className={`mini-toggle ${checkpoints ? 'on' : ''}`} /></button>
        <button type="button" className="fit-button" aria-label="Fit all routes" onClick={() => { if (map.current && plan) { map.current.stop(); map.current.fitBounds(L.latLngBounds(plan.routes.flatMap(r => r.geometry.map(([lon, lat]) => L.latLng(lat, lon)))), { padding: [48, 48], animate: false }) } }}><Expand size={16} /></button></div>}
      {!plan && !loading && <div className="map-empty"><span className="map-empty-icon"><RouteIcon size={28} /></span><h2>See the weather along your route.</h2><p>Choose your cities and compare the conditions<br />at each estimated arrival.</p><button type="button" disabled={!demoEnabled} onClick={onDemo}>Explore the demo <span>↗</span></button><small>Synthetic Chicago–Detroit example</small></div>}
      {loading && <div className="map-loading"><span className="loading-ring" /><strong>Looking down the road…</strong><p>Finding routes and checking forecasts along your trip.</p></div>}
      {tileError && <div className="tile-notice">Basemap unavailable. Route geometry and forecast overlays remain usable.</div>}
      {plan && <div className="map-scale-note">{heatmap ? 'Corridor colors: hourly weather + load risk' : 'Forecast layer hidden'}<br /><span>Route dots: arrival-time risk · Selected route only</span></div>}
    </div>
  </div>
}
