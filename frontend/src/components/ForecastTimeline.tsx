import { CloudSun } from 'lucide-react'
import { riskColors } from '../constants'
import type { Plan } from '../types'
import { displayTime } from '../utils/format'

type ForecastTimelineProps = {
  plan: Plan | null
  hour: number
  zone: string
  onHourChange: (hour: number) => void
}

export function ForecastTimeline({ plan, hour, zone, onHourChange }: ForecastTimelineProps) {
  return (
    <section className={`forecast-panel ${!plan ? 'disabled' : ''}`} aria-label="Corridor forecast">
      <div className="forecast-heading">
        <div className="forecast-title">
          <span className="section-icon">
            <CloudSun size={19} />
          </span>
          <div>
            <h2>Weather along the corridor</h2>
            <p>Hourly snapshot · independent of your arrival-time analysis</p>
          </div>
        </div>
        <div className="forecast-time">
          <span>Forecast at</span>
          <strong>
            {plan
              ? displayTime(plan.corridor.timestamps[hour], zone, true)
              : 'Plan a trip to explore'}
          </strong>
        </div>
      </div>
      <div className="slider-row">
        <span>+{hour}h</span>
        <input
          aria-label="Forecast hour"
          type="range"
          min="0"
          max="48"
          step="1"
          value={hour}
          disabled={!plan}
          onChange={(e) => onHourChange(Number(e.target.value))}
        />
        <span>48h</span>
      </div>
      <div className="slider-ticks">
        <span>Next full hour</span>
        <span>+12h</span>
        <span>+24h</span>
        <span>+36h</span>
        <span>+48h</span>
      </div>
      <div className="forecast-legend">
        <span>Weather risk</span>
        {Object.entries(riskColors).map(([label, color]) => (
          <span key={label}>
            <i style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </section>
  )
}
