import { useMemo } from 'react'
import { CircleMarker, Pane, Popup, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { riskColors } from '../../constants'
import type { Plan } from '../../types'
import { displayTime, value } from '../../utils/format'

export function CheckpointMarkers({
  plan,
  selected,
  visible,
  zone,
}: {
  plan: Plan
  selected: string | null
  visible: boolean
  zone: string
}) {
  const checkpointRenderer = useMemo(() => L.svg({ pane: 'checkpoints' }), [])
  return (
    <Pane name="checkpoints" style={{ zIndex: 460 }}>
      {visible &&
        plan.routes
          .find((r) => r.id === selected)
          ?.checkpoints.map((point, i) => (
            <CircleMarker
              key={point.id}
              renderer={checkpointRenderer}
              className="weather-checkpoint"
              center={[point.coordinate[1], point.coordinate[0]]}
              radius={i === 0 ? 7 : 5}
              pathOptions={{
                className: 'weather-checkpoint',
                color: '#163139',
                weight: 2,
                fillColor: riskColors[point.risk.label],
                fillOpacity: 1,
              }}
            >
              <Tooltip>
                Checkpoint {i + 1} · Mile {Math.round(point.mile)} · {point.risk.label}
              </Tooltip>
              <Popup
                maxHeight={240}
                autoPanPaddingTopLeft={[12, 64]}
                autoPanPaddingBottomRight={[12, 84]}
              >
                <div className="weather-popup">
                  <span className="popup-eyebrow">
                    {plan.routes.find((r) => r.id === selected)?.name} · Checkpoint {i + 1}
                  </span>
                  <strong>
                    <i style={{ background: riskColors[point.risk.label] }} />
                    {point.risk.label}
                  </strong>
                  <p>
                    Mile {point.mile.toFixed(1)} · ETA {displayTime(point.arrival, zone, true)}
                  </p>
                  <div className="popup-weather">
                    <span>
                      Wind
                      <b>
                        {value(point.weather?.wind_mph)} <small>mph</small>
                      </b>
                    </span>
                    <span>
                      Rain
                      <b>
                        {value(point.weather?.rain_in, 2)} <small>in/h</small>
                      </b>
                    </span>
                    <span>
                      Snow
                      <b>
                        {value(point.weather?.snow_in, 2)} <small>in/h</small>
                      </b>
                    </span>
                  </div>
                  <ul>
                    {point.risk.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  <small>
                    Hourly forecast:{' '}
                    {point.weather ? displayTime(point.weather.time, zone, true) : 'Unavailable'}.
                    Risk uses your trip’s arrival time and load.
                  </small>
                </div>
              </Popup>
            </CircleMarker>
          ))}
    </Pane>
  )
}
