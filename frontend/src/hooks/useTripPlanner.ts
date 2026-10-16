import { useEffect, useRef, useState } from 'react'
import { chicago, detroit } from '../constants'
import { api } from '../lib/api'
import { requestPlan } from '../lib/plan'
import type { Capabilities, Place, Plan } from '../types'
import { localDate } from '../utils/format'

/** Owns editable trip inputs and the last successfully evaluated plan. */
export function useTripPlanner() {
  const [origin, setOrigin] = useState<Place | null>(chicago)
  const [destination, setDestination] = useState<Place | null>(detroit)
  const [placeRevision, setPlaceRevision] = useState(0)
  const [zone, setZone] = useState('America/Chicago')
  const [departure, setDeparture] = useState(() => localDate('America/Chicago'))
  const [load, setLoad] = useState('32000')
  const [spacing, setSpacing] = useState(25)
  const [demo, setDemo] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [hour, setHour] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submissionAttempt, setSubmissionAttempt] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [displayZone, setDisplayZone] = useState(zone)
  const [demoEnabled, setDemoEnabled] = useState(true)
  const errorRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const activeRequest = useRef(false)
  const capabilitiesRequest = useRef<Promise<Capabilities> | null>(null)
  useEffect(() => {
    const request = api<Capabilities>('/api/health')
    capabilitiesRequest.current = request
    request.then((data) => setDemoEnabled(data.demo_enabled)).catch(() => {})
  }, [])
  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error, submissionAttempt])
  function changed() {
    if (plan) setDirty(true)
  }
  async function compare(useDemo = demo) {
    if (activeRequest.current) return
    // Re-focus repeated validation messages even when React batches the same error value.
    setSubmissionAttempt((attempt) => attempt + 1)
    setError('')
    const from = useDemo ? chicago : origin,
      to = useDemo ? detroit : destination
    if (!from || !to) {
      setError('Select an origin and destination from the city search results.')
      return
    }
    if (
      load.trim() === '' ||
      !Number.isFinite(Number(load)) ||
      Number(load) < 0 ||
      Number(load) > 120000
    ) {
      setError('Enter a load between 0 and 120,000 lb.')
      return
    }
    if (!departure) {
      setError('Choose a departure date and time.')
      return
    }
    activeRequest.current = true
    setLoading(true)
    if (useDemo) {
      setDemo(true)
      setOrigin(chicago)
      setDestination(detroit)
    }
    try {
      const capabilities = useDemo
        ? null
        : await capabilitiesRequest.current?.catch(() => {
            // Retry a failed startup health check rather than selecting the wrong transport.
            capabilitiesRequest.current = api<Capabilities>('/api/health')
            return capabilitiesRequest.current
          })
      const result = await requestPlan(
        {
          origin: from,
          destination: to,
          departure_local: departure,
          timezone: zone,
          load_lb: Number(load),
          spacing_miles: spacing,
          demo: useDemo,
        },
        capabilities?.weather_transport ?? 'server',
      )
      setPlan(result)
      setSelected(result.recommended_id ?? result.routes[0].id)
      setHour(0)
      setDirty(false)
      setDisplayZone(zone)
      if (window.innerWidth < 900)
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to compare routes. Try again.')
    } finally {
      activeRequest.current = false
      setLoading(false)
    }
  }
  return {
    origin,
    destination,
    placeRevision,
    zone,
    departure,
    load,
    spacing,
    demo,
    plan,
    selected,
    hour,
    loading,
    error,
    dirty,
    displayZone,
    demoEnabled,
    errorRef,
    resultsRef,
    setOrigin,
    setDestination,
    setPlaceRevision,
    setZone,
    setDeparture,
    setLoad,
    setSpacing,
    setDemo,
    setSelected,
    setHour,
    changed,
    compare,
  }
}

export type TripPlanner = ReturnType<typeof useTripPlanner>
