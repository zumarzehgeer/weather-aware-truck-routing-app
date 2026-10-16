import { useState } from 'react'
import { ArrowRight, CloudSun, Compass, Info, Route as RouteIcon } from 'lucide-react'
import { RiskGuide } from './components/RiskGuide'
import { TripResults } from './components/TripResults'
import { TripSidebar } from './components/TripSidebar'
import { useTripPlanner } from './hooks/useTripPlanner'

export default function App() {
  const planner = useTripPlanner()
  const [guide, setGuide] = useState(false)

  return (
    <>
      <header className="app-header">
        <a href="/" className="brand" aria-label="Waycast home">
          <span className="brand-mark">
            <RouteIcon size={24} strokeWidth={2.2} />
          </span>
          <span>
            waycast<span className="brand-dot">.</span>
          </span>
          <span className="brand-divider" />
          <span className="brand-descriptor">Weather-aware routing</span>
        </a>
        <div className="header-actions">
          <span className="header-context">
            <Compass size={15} />
            Route planner
          </span>
          <button type="button" onClick={() => setGuide(true)}>
            <Info size={16} />
            Risk guide
          </button>
        </div>
      </header>
      <main className="workspace">
        <div className="page-intro">
          <div>
            <h1>Weather-aware route planning</h1>
            <p>See the conditions ahead. Compare the miles that matter.</p>
          </div>
          <div className="intro-note">
            <CloudSun size={31} strokeWidth={1.3} />
            <span>
              Arrival-time weather
              <strong>48-hour corridor outlook</strong>
            </span>
          </div>
        </div>
        <div className="workspace-grid">
          <TripSidebar planner={planner} onOpenGuide={() => setGuide(true)} />
          <TripResults planner={planner} />
        </div>
        <footer className="app-footer">
          <span>
            <CloudSun size={16} />
            waycast. <span>Weather-aware truck routing</span>
          </span>
          <button type="button" onClick={() => setGuide(true)}>
            How we calculate risk
            <ArrowRight size={13} />
          </button>
        </footer>
      </main>
      {guide && <RiskGuide onClose={() => setGuide(false)} />}
    </>
  )
}
