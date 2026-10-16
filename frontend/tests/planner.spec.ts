import { test, expect } from './fixtures'

test('validation, geocoding keyboard selection, loading, and provider error', async ({ page }) => {
  await page.route('**/api/geocode*', (route) =>
    route.fulfill({
      json: {
        results: [
          { name: 'Boston, Massachusetts, United States', latitude: 42.36, longitude: -71.05 },
        ],
      },
    }),
  )
  await page.goto('/')
  await page.getByLabel('Origin', { exact: true }).fill('Boston')
  await expect(
    page.getByRole('option', { name: 'Boston, Massachusetts, United States' }),
  ).toBeVisible()
  await page.getByLabel('Origin', { exact: true }).press('ArrowDown')
  await page.getByLabel('Origin', { exact: true }).press('Enter')
  await expect(page.getByLabel('Origin', { exact: true })).toHaveValue(
    'Boston, Massachusetts, United States',
  )
  await page.getByLabel('Truck load weight').fill('-1')
  await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('between 0 and 120,000')
  await page.getByLabel('Truck load weight').fill('32000')
  await page.route('**/api/plan', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    await route.fulfill({
      status: 503,
      json: {
        error: {
          code: 'provider_rate_limit',
          message: 'Weather rate limit reached. Wait before retrying.',
        },
      },
    })
  })
  await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
  await expect(page.getByText('Looking down the road…')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('rate limit reached')
  await expect(page.getByRole('button', { name: 'Compare routes', exact: true })).toBeEnabled()
})

test('incomplete weather and all No Travel routes never get recommended', async ({
  page,
  request,
}) => {
  const date = new Date(Date.now() + 3600_000).toISOString().slice(0, 16)
  const res = await request.post('/api/plan', {
    data: {
      origin: { name: 'Chicago', latitude: 41.88, longitude: -87.63 },
      destination: { name: 'Detroit', latitude: 42.33, longitude: -83.05 },
      timezone: 'UTC',
      departure_local: date,
      load_lb: 32000,
      spacing_miles: 25,
      demo: true,
    },
  })
  expect(res.ok()).toBe(true)
  const fixture = await res.json()
  fixture.recommended_id = null
  fixture.explanation = 'Every route contains No Travel conditions. None can be recommended.'
  fixture.routes.forEach((r: { summary: Record<string, unknown> }) => {
    r.summary.no_travel = true
    r.summary.complete = false
    r.summary.average_risk = null
  })
  fixture.warnings = ['Missing weather cannot be treated as low risk.']
  await page.route('**/api/plan', (route) => route.fulfill({ json: fixture }))
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

test('repeated validation errors regain focus without sending trip requests', async ({ page }) => {
  let tripRequests = 0
  await page.route('**/api/plan', (route) => {
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

test('all demo entry points are disabled when the server disables demo', async ({ page }) => {
  await page.route('**/api/health', (route) =>
    route.fulfill({ json: { status: 'ok', demo_enabled: false } }),
  )
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Demo trip' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Explore the demo' })).toBeDisabled()
})
