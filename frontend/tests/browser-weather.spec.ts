import { test, expect } from './fixtures'

for (const available of [true, false]) {
  test(`browser weather transport handles ${available ? 'available forecasts and caching' : 'provider throttling without fallback'}`, async ({
    page,
    request,
  }) => {
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
    const fixture = await response.json()
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
            json: [
              { hourly: { time: [1792108800] }, hourly_units: {} },
              { hourly: { time: [1792108800] }, hourly_units: {} },
            ],
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
