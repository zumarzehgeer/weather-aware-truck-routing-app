import { test, expect } from './fixtures'
import type { Plan } from '../src/types'
import type { APIRequestContext } from '@playwright/test'

// Reuse the real demo response within each worker to stay below the API's trip limit.
let demoTemplate: Plan | undefined

async function demoPlan(request: APIRequestContext): Promise<Plan> {
  if (!demoTemplate) {
    const response = await request.post('/api/plan', {
      data: {
        origin: { name: 'Chicago', latitude: 41.8781, longitude: -87.6298 },
        destination: { name: 'Detroit', latitude: 42.3314, longitude: -83.0458 },
        departure_local: new Date(Date.now() + 3600_000).toISOString().slice(0, 16),
        timezone: 'UTC',
        load_lb: 32000,
        spacing_miles: 25,
        demo: true,
      },
    })
    expect(response.ok()).toBe(true)
    demoTemplate = await response.json()
  }
  return structuredClone(demoTemplate!)
}

function forecast() {
  const start = Math.floor(Date.now() / 86_400_000) * 86_400
  return {
    hourly: {
      time: Array.from({ length: 168 }, (_, hour) => start + hour * 3600),
      wind_speed_10m: Array(168).fill(10),
      rain: Array(168).fill(0),
      showers: Array(168).fill(0),
      snowfall: Array(168).fill(0),
    },
    hourly_units: { wind_speed_10m: 'mp/h', rain: 'inch', showers: 'inch', snowfall: 'inch' },
  }
}

test('weather cache refreshes at the UTC day boundary', async ({ page, request }) => {
  const fixture = await demoPlan(request)
  fixture.mode = 'live'
  const today = Math.floor(Date.now() / 86_400_000) * 86_400_000
  await page.clock.install({ time: new Date(today + 86_400_000 - 60_000) })
  let weatherCalls = 0
  let completions = 0
  await page.route('**/api/health', (route) =>
    route.fulfill({ json: { status: 'ok', demo_enabled: true, weather_transport: 'browser' } }),
  )
  await page.route('**/api/plan/prepare', (route) =>
    route.fulfill({ json: { token: 'prepared-test-token', locations: [[-87.63, 41.88]] } }),
  )
  await page.route('https://api.open-meteo.com/v1/forecast?*', (route) => {
    weatherCalls++
    const data = forecast()
    if (weatherCalls > 1) data.hourly.time = data.hourly.time.map((time) => time + 86400)
    return route.fulfill({ json: data })
  })
  await page.route('**/api/plan/complete', (route) => {
    completions++
    return route.fulfill({ json: fixture })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Select Route A' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Compare routes', exact: true })).toBeEnabled()
  await page.clock.fastForward(60_001)
  await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
  await expect.poll(() => weatherCalls).toBe(2)
  await expect.poll(() => completions).toBe(2)
})

for (const available of [true, false]) {
  test(`browser weather transport handles ${available ? 'available forecasts and caching' : 'provider throttling without fallback'}`, async ({
    page,
    request,
  }) => {
    const fixture = await demoPlan(request)
    fixture.mode = 'live'
    fixture.providers.weather_transport = 'browser'
    if (!available) {
      fixture.recommended_id = null
      fixture.warnings = ['Browser weather unavailable; missing forecasts remain Unknown.']
      fixture.explanation = 'No fully evaluated route is eligible.'
      for (const route of fixture.routes) {
        route.summary.complete = false
        route.summary.average_risk = null
      }
    }
    let weatherCalls = 0,
      completed = false,
      healthCalls = 0
    await page.route('**/api/health', (route) => {
      healthCalls++
      if (available && healthCalls === 1)
        return route.fulfill({ status: 503, json: { error: { message: 'Startup unavailable' } } })
      return route.fulfill({
        json: { status: 'ok', demo_enabled: true, weather_transport: 'browser' },
      })
    })
    await page.route('**/api/plan/prepare', (route) =>
      route.fulfill({
        json: {
          token: 'prepared-test-token',
          locations: [
            [-87.63, 41.88],
            [-87.5, 41.9],
          ],
        },
      }),
    )
    await page.route('https://api.open-meteo.com/v1/forecast?*', (route) => {
      weatherCalls++
      return available
        ? route.fulfill({
            json: [forecast(), forecast()],
          })
        : route.fulfill({ status: 429, json: { error: true, reason: 'Daily quota exceeded' } })
    })
    await page.route('**/api/plan/complete', (route) => {
      const body = route.request().postDataJSON()
      expect(body.token).toBe('prepared-test-token')
      expect(body.weather_batches).toHaveLength(1)
      if (available) expect(body.weather_batches[0]).toHaveLength(2)
      else expect(body.weather_batches[0]).toBeNull()
      completed = true
      return route.fulfill({ json: fixture })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Select Route A' })).toBeVisible()
    expect(weatherCalls).toBe(1)
    expect(completed).toBe(true)
    if (available) expect(healthCalls).toBe(2)
    if (!available) {
      await expect(page.getByText('No route can be recommended')).toBeVisible()
      await expect(
        page.getByText('Browser weather unavailable; missing forecasts remain Unknown.'),
      ).toBeVisible()
    }
    await page.getByLabel('Truck load weight').fill('45000')
    await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
    await expect(page.locator('.stale-banner')).toHaveCount(0)
    expect(weatherCalls).toBe(1)
  })
}

for (const failure of [
  'missing fields',
  'unsupported units',
  'duplicate hours',
  'truncated horizon',
  'stale horizon',
]) {
  test(`HTTP 200 weather with ${failure} is fetched again after provider recovery`, async ({
    page,
    request,
  }) => {
    const fixture = await demoPlan(request)
    fixture.mode = 'live'
    fixture.providers.weather_transport = 'browser'
    let weatherCalls = 0
    let completions = 0
    await page.route('**/api/health', (route) =>
      route.fulfill({ json: { status: 'ok', demo_enabled: true, weather_transport: 'browser' } }),
    )
    await page.route('**/api/plan/prepare', (route) =>
      route.fulfill({ json: { token: 'prepared-test-token', locations: [[-87.63, 41.88]] } }),
    )
    await page.route('https://api.open-meteo.com/v1/forecast?*', (route) => {
      weatherCalls++
      const malformed = forecast()
      if (failure === 'duplicate hours') malformed.hourly.time[1] = malformed.hourly.time[0]
      if (failure === 'stale horizon')
        malformed.hourly.time = malformed.hourly.time.map((time) => time - 86400)
      if (failure === 'truncated horizon') {
        for (const field of ['time', 'wind_speed_10m', 'rain', 'showers', 'snowfall'] as const)
          malformed.hourly[field].splice(24)
      }
      return route.fulfill({
        json:
          weatherCalls > 1
            ? forecast()
            : failure === 'duplicate hours' ||
                failure === 'truncated horizon' ||
                failure === 'stale horizon'
              ? malformed
              : failure === 'missing fields'
                ? { hourly: { time: [1792108800] } }
                : {
                    ...forecast(),
                    hourly_units: { ...forecast().hourly_units, wind_speed_10m: 'unsupported' },
                  },
      })
    })
    await page.route('**/api/plan/complete', (route) => {
      completions++
      const body = route.request().postDataJSON()
      if (completions > 1) expect(body.weather_batches[0]).toEqual(forecast())
      return route.fulfill({ json: fixture })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Select Route A' })).toBeVisible()
    await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
    await expect.poll(() => weatherCalls).toBe(2)
    await expect.poll(() => completions).toBe(2)
  })
}
