import { memo } from 'react'
import { Popup, Rectangle } from 'react-leaflet'
import { riskColors } from '../../constants'
import type { Plan } from '../../types'
import { displayTime, value } from '../../utils/format'
import { LayerPane } from './LayerPane'

export const ForecastCorridor = memo(function ForecastCorridor({
  plan,
  hour,
  visible,
  zone,
}: {
  plan: Plan
  hour: number
  visible: boolean
  zone: string
}) {
  return (
    <LayerPane name="forecast-corridor" zIndex={350} visible={visible}>
      {plan.corridor.cells.map((cell, i) => {
        const snapshot = cell.forecasts[hour]
        return (
          <Rectangle
            key={i}
            className="forecast-cell"
            bounds={cell.bounds}
            pathOptions={{
              stroke: false,
              fillColor: riskColors[snapshot.risk.label],
              fillOpacity: 0.3,
            }}
          >
            <Popup
              maxHeight={240}
              autoPanPaddingTopLeft={[12, 64]}
              autoPanPaddingBottomRight={[12, 84]}
            >
              <div className="weather-popup">
                <span className="popup-eyebrow">Corridor forecast · snapshot</span>
                <strong>{snapshot.risk.label}</strong>
                <p>{displayTime(plan.corridor.timestamps[hour], zone, true)}</p>
                <span>
                  Wind {value(snapshot.weather?.wind_mph)} mph · Rain{' '}
                  {value(snapshot.weather?.rain_in, 2)} in/h · Snow{' '}
                  {value(snapshot.weather?.snow_in, 2)} in/h
                </span>
                <small>Cell-center forecast; not arrival-time analysis.</small>
              </div>
            </Popup>
          </Rectangle>
        )
      })}
    </LayerPane>
  )
})
