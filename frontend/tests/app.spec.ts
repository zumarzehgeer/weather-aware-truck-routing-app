import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Offline-independent E2E: basemap failures are tested separately. No live-provider quotas consumed.
  await page.route('https://tile.openstreetmap.org/**', route => route.abort())
})

test('demo: route selection, checkpoint popup, forecast slider, guide, mobile layout', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Weather-aware route planning' })).toBeVisible()
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await expect(page.getByText('Synthetic routes and forecasts for interaction testing.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select Route A' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select Route B' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select Route C' })).toBeVisible()
  await page.getByRole('button', { name: 'Select Route B' }).click()
  await expect(page.getByRole('button', { name: 'Select Route B' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.weather-checkpoint').first()).toBeAttached()
  await page.locator('.weather-checkpoint').nth(2).click()
  await expect(page.locator('.weather-popup')).toContainText('Wind')
  await expect(page.locator('.weather-popup')).toContainText('Route B · Checkpoint 3')
  await expect(page.locator('.weather-popup')).toContainText('in/h')
  await page.locator('.leaflet-popup-close-button').click()
  await expect(page.locator('.weather-popup')).toHaveCount(0)
  for (const endpoint of ['first', 'last'] as const) {
    await page.getByRole('button', { name: 'Fit all routes' }).click()
    const point = endpoint === 'first' ? page.locator('.weather-checkpoint').first() : page.locator('.weather-checkpoint').last()
    await point.click()
    await expect(page.locator('.weather-popup')).toContainText('Route B · Checkpoint')
    await expect(page.locator('.weather-popup')).toContainText('ETA')
    await page.locator('.leaflet-popup-close-button').click()
    await expect(page.locator('.weather-popup')).toHaveCount(0)
  }
  let calls = 0
  page.on('request', request => { if (request.url().includes('/api/')) calls++ })
  const oldTimestamp = await page.locator('.forecast-time strong').innerText()
  const oldColors = await page.locator('.forecast-cell').evaluateAll(items => items.map(item => item.getAttribute('fill')))
  const slider = page.getByRole('slider', { name: 'Forecast hour' })
  await slider.focus(); await slider.press('End')
  await expect(slider).toHaveValue('48')
  await expect(page.locator('.forecast-time strong')).not.toHaveText(oldTimestamp)
  await expect(page.locator('.slider-row')).toContainText('+48h')
  expect(await page.locator('.forecast-cell').evaluateAll(items => items.map(item => item.getAttribute('fill')))).not.toEqual(oldColors)
  expect(calls).toBe(0)
  await page.getByRole('button', { name: 'Forecast layer' }).click()
  await expect(page.locator('.forecast-cell').first()).toBeHidden()
  await expect(page.getByRole('button', { name: 'Forecast layer' })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Forecast layer' }).click()
  await expect(page.locator('.forecast-cell').first()).toBeVisible()
  await page.getByRole('button', { name: 'Checkpoints', exact: true }).click()
  await expect(page.locator('.weather-checkpoint')).toHaveCount(0)
  await page.getByRole('button', { name: 'Checkpoints', exact: true }).click()
  await expect(page.locator('.weather-checkpoint').first()).toBeVisible()
  await page.getByRole('button', { name: 'Fit all routes' }).click()
  await page.getByRole('button', { name: 'Risk guide', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Wind ≥55 mph means No Travel')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Basemap unavailable.', { exact: false })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
  await page.screenshot({ path: `test-results/${info.project.name}-demo.png`, fullPage: true })
})

test('validation, geocoding keyboard selection, loading, and provider error', async ({ page }) => {
  await page.route('**/api/geocode*', route => route.fulfill({ json: { results: [{ name: 'Boston, Massachusetts, United States', latitude: 42.36, longitude: -71.05 }] } }))
  await page.goto('/')
  await page.getByLabel('Origin', { exact: true }).fill('Boston')
  await expect(page.getByRole('option', { name: 'Boston, Massachusetts, United States' })).toBeVisible()
  await page.getByLabel('Origin', { exact: true }).press('ArrowDown')
  await page.getByLabel('Origin', { exact: true }).press('Enter')
  await expect(page.getByLabel('Origin', { exact: true })).toHaveValue('Boston, Massachusetts, United States')
  await page.getByLabel('Truck load weight').fill('-1')
  await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('between 0 and 120,000')
  await page.getByLabel('Truck load weight').fill('32000')
  await page.route('**/api/plan', async route => {
    await new Promise(resolve => setTimeout(resolve, 500))
    await route.fulfill({ status: 503, json: { error: { code: 'provider_rate_limit', message: 'Weather rate limit reached. Wait before retrying.' } } })
  })
  await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
  await expect(page.getByText('Looking down the road…')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('rate limit reached')
  await expect(page.getByRole('button', { name: 'Compare routes', exact: true })).toBeEnabled()
})

test('incomplete weather and all No Travel routes never get recommended', async ({ page, request }) => {
  const date = new Date(Date.now() + 3600_000).toISOString().slice(0, 16)
  const res = await request.post('/api/plan', { data: { origin: { name: 'Chicago', latitude: 41.88, longitude: -87.63 }, destination: { name: 'Detroit', latitude: 42.33, longitude: -83.05 }, timezone: 'UTC', departure_local: date, load_lb: 32000, spacing_miles: 25, demo: true } })
  expect(res.ok()).toBe(true)
  const fixture = await res.json()
  fixture.recommended_id = null
  fixture.explanation = 'Every route contains No Travel conditions. None can be recommended.'
  fixture.routes.forEach((r: { summary: Record<string, unknown> }) => { r.summary.no_travel = true; r.summary.complete = false; r.summary.average_risk = null })
  fixture.warnings = ['Missing weather cannot be treated as low risk.']
  await page.route('**/api/plan', route => route.fulfill({ json: fixture }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await expect(page.getByRole('heading', { name: 'No route can be recommended' })).toBeVisible()
  await expect(page.getByText('Forecast gaps · excluded from recommendation')).toHaveCount(3)
  await expect(page.locator('.route-metrics').first()).toContainText('Unknown')
  const warning = await page.locator('.plan-warnings').boundingBox()
  const map = await page.locator('.map-shell').boundingBox()
  expect(warning).not.toBeNull()
  expect(map).not.toBeNull()
  expect(warning!.y + warning!.height).toBeLessThanOrEqual(map!.y)
  await page.getByLabel('Truck load weight').fill('45000')
  await expect(page.getByText('Inputs changed.', { exact: false })).toBeVisible()
})

test('empty city search and request failures are visible', async ({ page }) => {
  await page.route('**/api/geocode*', route => route.fulfill({ json: { results: [] } }))
  await page.goto('/')
  await page.getByLabel('Origin', { exact: true }).fill('Zzzunknown')
  await expect(page.getByText('No places found. Try a city name.')).toBeVisible()
  await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Select an origin and destination')
  await page.unroute('**/api/geocode*')
  await page.route('**/api/geocode*', route => route.fulfill({ status: 502, json: { error: { message: 'Place search is unavailable. Check provider access.' } } }))
  await page.getByLabel('Origin', { exact: true }).fill('Chicago')
  await expect(page.getByText('Place search is unavailable. Check provider access.')).toBeVisible()
})

test('repeated validation errors regain focus without sending trip requests', async ({ page }) => {
  let tripRequests = 0
  await page.route('**/api/plan', route => {
    tripRequests++
    return route.abort()
  })
  await page.goto('/')
  for (const value of ['', '120001', '120001']) {
    await page.getByLabel('Truck load weight').fill(value)
    await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('between 0 and 120,000')
    await expect(page.getByRole('alert')).toBeFocused()
  }
  expect(tripRequests).toBe(0)
})

test('city suggestions reopen with arrow keys after Escape without refetching', async ({ page }) => {
  let searches = 0
  await page.route('**/api/geocode*', route => {
    searches++
    return route.fulfill({ json: { results: [
      { name: 'Boston, Massachusetts, United States', latitude: 42.36, longitude: -71.05 },
      { name: 'Boston, England, United Kingdom', latitude: 52.98, longitude: -0.02 },
    ] } })
  })
  await page.goto('/')
  const origin = page.getByLabel('Origin', { exact: true })
  await origin.fill('Boston')
  await expect(page.getByRole('listbox', { name: 'Origin search results' }).getByRole('option')).toHaveCount(2)
  await origin.press('ArrowDown')
  await origin.press('Escape')
  await expect(origin).toHaveAttribute('aria-expanded', 'false')
  await expect(origin).not.toHaveAttribute('aria-activedescendant')
  await origin.press('ArrowDown')
  await expect(page.getByRole('option', { name: 'Boston, Massachusetts, United States' })).toHaveAttribute('aria-selected', 'true')
  await origin.press('Escape')
  await origin.press('ArrowUp')
  await expect(page.getByRole('option', { name: 'Boston, England, United Kingdom' })).toHaveAttribute('aria-selected', 'true')
  await origin.press('Enter')
  await expect(origin).toHaveValue('Boston, England, United Kingdom')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  expect(searches).toBe(1)
})

test('swapping clears unresolved text and preserves selected locations', async ({ page }) => {
  await page.route('**/api/geocode*', route => route.fulfill({ json: { results: [] } }))
  await page.goto('/')
  const origin = page.getByLabel('Origin', { exact: true })
  const destination = page.getByLabel('Destination', { exact: true })
  await origin.fill('Unresolved city')
  await page.getByRole('button', { name: 'Swap origin and destination' }).click()
  await expect(origin).toHaveValue('Detroit, Michigan, United States')
  await expect(destination).toHaveValue('')
  await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Select an origin and destination')
  await page.getByRole('button', { name: 'Swap origin and destination' }).click()
  await expect(origin).toHaveValue('')
  await expect(destination).toHaveValue('Detroit, Michigan, United States')
  await origin.fill('Still typing')
  await expect(origin).toHaveValue('Still typing')
})

test('switching demo and live clears suggestions for the previous city', async ({ page }) => {
  await page.route('**/api/geocode*', route => {
    const query = new URL(route.request().url()).searchParams.get('q')
    return route.fulfill({ json: { results: query === 'Boston'
      ? [{ name: 'Boston, Massachusetts, United States', latitude: 42.36, longitude: -71.05 }]
      : [{ name: 'Denver, Colorado, United States', latitude: 39.74, longitude: -104.99 }]
    } })
  })
  await page.goto('/')
  for (const field of [
    { label: 'Origin', query: 'Boston', result: 'Boston, Massachusetts, United States', reset: 'Chicago, Illinois, United States' },
    { label: 'Destination', query: 'Denver', result: 'Denver, Colorado, United States', reset: 'Detroit, Michigan, United States' },
  ]) {
    const input = page.getByLabel(field.label, { exact: true })
    await input.fill(field.query)
    await expect(page.getByRole('option', { name: field.result })).toBeVisible()
    await page.getByRole('button', { name: 'Demo trip', exact: true }).click()
    await page.getByRole('button', { name: 'Live routes', exact: true }).click()
    await input.click()
    await expect(input).toHaveValue(field.reset)
    await expect(input).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('listbox')).toHaveCount(0)
  }
})

test('all demo entry points are disabled when the server disables demo', async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok', demo_enabled: false } }))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Demo trip' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Explore the demo' })).toBeDisabled()
})

test('risk guide returns keyboard focus to each opener after Escape or close', async ({ page }, info) => {
  await page.goto('/')
  const openers = ['Risk guide', 'How we calculate risk']
  if (info.project.name === 'desktop') openers.push('Understand the risk model')
  for (const name of openers) {
    const opener = page.getByRole('button', { name, exact: true })
    await opener.click()
    await expect(page.getByRole('dialog', { name: 'Weather risk, explained.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close risk guide' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(opener).toBeFocused()
    await opener.press('Enter')
    await page.getByRole('button', { name: 'Close risk guide' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(opener).toBeFocused()
  }
})

test('workspace adapts from wide comparison rail to stacked mobile cards', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'One browser covers the responsive widths.')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await expect(page.getByRole('button', { name: 'Select Route C' })).toBeVisible()
  await expect(page.locator('.tile-notice')).toBeVisible()
  for (const width of [1440, 1024, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `Overflow at ${width}px`).toBe(true)
    const map = await page.locator('.map-shell').boundingBox()
    const comparison = await page.getByRole('region', { name: 'Route comparison', exact: true }).boundingBox()
    expect(map).not.toBeNull()
    expect(comparison).not.toBeNull()
    if (width >= 1440) {
      expect(comparison!.x).toBeGreaterThanOrEqual(map!.x + map!.width)
    } else {
      const forecast = await page.getByRole('region', { name: 'Corridor forecast' }).boundingBox()
      expect(comparison!.y).toBeGreaterThanOrEqual(forecast!.y + forecast!.height)
    }
    if (width <= 820) {
      const cards = await page.locator('.route-card').all()
      for (let index = 1; index < cards.length; index++) {
        const previous = await cards[index - 1].boundingBox()
        const current = await cards[index].boundingBox()
        expect(current!.y).toBeGreaterThanOrEqual(previous!.y + previous!.height)
      }
      const notice = await page.locator('.tile-notice').boundingBox()
      const attribution = await page.locator('.leaflet-control-attribution').boundingBox()
      expect(attribution!.y + attribution!.height).toBeLessThanOrEqual(notice!.y)
      await page.getByRole('button', { name: 'Fit all routes' }).click()
      await page.locator('.weather-checkpoint').first().click()
      await expect(page.locator('.weather-popup')).toBeVisible()
      const close = page.getByRole('button', { name: 'Close popup', exact: true })
      await expect(close).toBeInViewport()
      await expect.poll(async () => {
        const popup = await page.locator('.leaflet-popup').boundingBox()
        const mapBody = await page.locator('.map-body').boundingBox()
        return !!popup && !!mapBody && popup.x >= mapBody.x && popup.x + popup.width <= mapBody.x + mapBody.width && popup.y >= mapBody.y && popup.y + popup.height <= mapBody.y + mapBody.height
      }, { message: `Popup stays inside the map after panning at ${width}px` }).toBe(true)
      await close.click()
      await expect(page.locator('.weather-popup')).toHaveCount(0)
    }
  }
  await page.getByRole('button', { name: 'Risk guide', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
