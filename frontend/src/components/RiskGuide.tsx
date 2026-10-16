import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { riskColors } from '../constants'

export function RiskGuide({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="guide-dialog"
      aria-labelledby="risk-guide-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="guide-inner">
        <button
          type="button"
          className="dialog-close"
          aria-label="Close risk guide"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <h2 id="risk-guide-title">Weather risk, explained.</h2>
        <p>
          Each checkpoint uses the highest applicable condition, including the supplied load rules.
        </p>
        <div className="table-scroll">
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
          45–&lt;55 mph and a load over 30,000 lb means No Travel. 35–&lt;45 mph and a load over
          40,000 lb means Severe. Wind ≥55 mph means No Travel at every load.
        </p>
        <h3>How we compare routes</h3>
        <p>
          Each interval inherits the higher risk of its two endpoints. Miles are summed by category,
          and averaged on a 0–4 scale (Low 0, Moderate 1, High 2, Severe 3, No Travel 4). Unknown
          endpoints make the interval unknown unless No Travel is already known.
        </p>
        <p>
          Fully evaluated routes without No Travel conditions are ranked by Severe miles, then High
          miles, then distance-weighted average, then travel time. Unknown data never counts as low
          risk.
        </p>
        <h3>Two views of the forecast</h3>
        <p>
          Route cards and checkpoint dots use weather at estimated arrival. The 0–48h corridor layer
          is an independent hourly snapshot, beginning at the next UTC hour. Its colors show the
          same weather/load risk at grid-cell centers; it is not radar or a continuous observation.
        </p>
        <p className="guide-disclaimer">
          OSRM driving routes do not consider truck height, weight limits, hazardous cargo, road
          closures, rest breaks, or live traffic. Weather forecasts and this supplied model do not
          establish road safety. Check official advisories and commercial truck navigation.
        </p>
      </div>
    </dialog>
  )
}
