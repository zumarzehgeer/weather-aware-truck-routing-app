import { api, ApiError } from './api'
import type { Plan, PlanRequest } from '../types'

type PreparedPlan = { token: string; locations: [number, number][] }
const weatherCache = new Map<string, { expires: number; data: unknown }>()
let weatherBlockedUntil = 0

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Reject malformed successes before they can prevent recovery on the next comparison. */
function cacheableForecast(entry: unknown) {
  if (!isObject(entry) || !isObject(entry.hourly) || !isObject(entry.hourly_units)) return false
  const hourly = entry.hourly,
    units = entry.hourly_units,
    times = hourly.time
  // GMT + forecast_days=7 requests the current UTC day's full seven-day horizon.
  const todayStart = Math.floor(Date.now() / 86_400_000) * 86_400
  if (
    !Array.isArray(times) ||
    times.length !== 7 * 24 ||
    times[0] !== todayStart ||
    !times.every(
      (time, index) =>
        typeof time === 'number' &&
        Number.isFinite(time) &&
        time % 3600 === 0 &&
        (index === 0 || time === times[index - 1] + 3600),
    )
  )
    return false
  return ['wind_speed_10m', 'rain', 'showers', 'snowfall'].every((field) => {
    const values = hourly[field]
    const supportedUnits =
      field === 'wind_speed_10m' ? ['mp/h', 'mph', 'km/h', 'm/s', 'kn'] : ['inch', 'in', 'mm', 'cm']
    return (
      typeof units[field] === 'string' &&
      supportedUnits.includes(units[field]) &&
      Array.isArray(values) &&
      values.length === times.length &&
      values.every(
        (value) =>
          value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0),
      )
    )
  })
}

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
          if (entries.length === coords.length && entries.every(cacheableForecast)) {
            if (weatherCache.size >= 12) weatherCache.delete(weatherCache.keys().next().value!)
            const now = Date.now()
            const nextDay = (Math.floor(now / 86_400_000) + 1) * 86_400_000
            weatherCache.set(key, { data, expires: Math.min(now + 30 * 60_000, nextDay) })
          }
          // Django still evaluates uncached input, preserving any known hazards in partial data.
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
