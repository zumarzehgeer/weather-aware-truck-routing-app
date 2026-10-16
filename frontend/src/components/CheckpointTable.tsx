import { riskColors } from '../constants'
import type { Route } from '../types'
import { displayTime, value } from '../utils/format'

export function CheckpointTable({ route, zone }: { route: Route | undefined; zone: string }) {
  return (
    <details className="checkpoint-details">
      <summary>
        Arrival-time checkpoints · {route?.name}
        <span>View weather details</span>
      </summary>
      <div className="table-scroll">
        <table>
          <caption>
            Selected route · all times in {zone}. Unknown forecasts are excluded from
            recommendation.
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
            {route?.checkpoints.map((point) => (
              <tr key={point.id}>
                <td>{point.mile.toFixed(1)}</td>
                <td>{displayTime(point.arrival, zone, true)}</td>
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
  )
}
