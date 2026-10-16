import { api, ApiError } from './api'
import type { Plan, PlanRequest } from '../types'

type PreparedPlan = { token: string; locations: [number, number][] }
const weatherCache = new Map<string, { expires: number; data: unknown }>()
let weatherBlockedUntil = 0

/** Public CORS weather requests use the visitor's normal provider access, without secrets. */
export async function requestPlan(input: PlanRequest, transport: 'server' | 'browser' = 'server') {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(new Error('Trip comparison timed out. Please retry.')),
    100_000,
  )
  const post = <T>(path: string, body: unknown) =>
    api<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  try {
    if (input.demo || transport === 'server') return await post<Plan>('/api/plan', input)
    const prepared = await post<PreparedPlan>('/api/plan/prepare', input)
    const batches: unknown[] = []
    for (const [key, cached] of weatherCache) {
      if (cached.expires <= Date.now()) weatherCache.delete(key)
    }
    for (let offset = 0; offset < prepared.locations.length; offset += 40) {
      const coords = prepared.locations.slice(offset, offset + 40)
      const url = new URL('https://api.open-meteo.com/v1/forecast')
      url.search = new URLSearchParams({
        latitude: coords.map((c) => c[1]).join(','),
        longitude: coords.map((c) => c[0]).join(','),
        hourly: 'wind_speed_10m,rain,showers,snowfall',
        wind_speed_unit: 'mph',
        precipitation_unit: 'inch',
        timezone: 'GMT',
        timeformat: 'unixtime',
        forecast_days: '7',
      }).toString()
      const key = url.toString()
      try {
        let data = weatherCache.get(key)?.data
        if (!data) {
          if (Date.now() < weatherBlockedUntil) {
            batches.push(null)
            continue
          }
          data = await api<unknown>(key, { signal: controller.signal })
          const entries = Array.isArray(data) ? data : [data]
          if (
            entries.length !== coords.length ||
            entries.some((entry) => !entry?.hourly || !Array.isArray(entry.hourly.time))
          ) {
            throw new Error('Weather provider returned malformed data.')
          }
          if (weatherCache.size >= 12) weatherCache.delete(weatherCache.keys().next().value!)
          weatherCache.set(key, { data, expires: Date.now() + 30 * 60_000 })
        }
        batches.push(data)
      } catch (error) {
        if (controller.signal.aborted) throw error
        if (error instanceof ApiError && error.status === 429)
          weatherBlockedUntil = Date.now() + 60_000
        // Send an unavailable batch; Django keeps these values Unknown, never calm or synthetic.
        batches.push(null)
      }
    }
    return await post<Plan>('/api/plan/complete', {
      token: prepared.token,
      weather_batches: batches,
    })
  } finally {
    clearTimeout(timeout)
  }
}
