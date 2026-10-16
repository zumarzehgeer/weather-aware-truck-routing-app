import { test, expect } from './fixtures'

test('demo: route selection, checkpoint popup, forecast slider, guide, mobile layout', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Weather-aware route planning' })).toBeVisible()
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await expect(
    page.getByText('Synthetic routes and forecasts for interaction testing.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select Route A' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select Route B' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select Route C' })).toBeVisible()
  await page.getByRole('button', { name: 'Select Route B' }).click()
  await expect(page.getByRole('button', { name: 'Select Route B' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('.weather-checkpoint').first()).toBeAttached()
  await page.locator('.weather-checkpoint').nth(2).click()
  await expect(page.locator('.weather-popup')).toContainText('Wind')
  await expect(page.locator('.weather-popup')).toContainText('Route B · Checkpoint 3')
  await expect(page.locator('.weather-popup')).toContainText('in/h')
  await page.locator('.leaflet-popup-close-button').click()
  await expect(page.locator('.weather-popup')).toHaveCount(0)
  for (const endpoint of ['first', 'last'] as const) {
    await page.getByRole('button', { name: 'Fit all routes' }).click()
    const point =
      endpoint === 'first'
        ? page.locator('.weather-checkpoint').first()
        : page.locator('.weather-checkpoint').last()
    await point.click()
    await expect(page.locator('.weather-popup')).toContainText('Route B · Checkpoint')
    await expect(page.locator('.weather-popup')).toContainText('ETA')
    await page.locator('.leaflet-popup-close-button').click()
    await expect(page.locator('.weather-popup')).toHaveCount(0)
  }
  let calls = 0
  page.on('request', (request) => {
    if (request.url().includes('/api/')) calls++
  })
  const oldTimestamp = await page.locator('.forecast-time strong').innerText()
  const oldColors = await page
    .locator('.forecast-cell')
    .evaluateAll((items) => items.map((item) => item.getAttribute('fill')))
  const slider = page.getByRole('slider', { name: 'Forecast hour' })
  await slider.focus()
  await slider.press('End')
  await expect(slider).toHaveValue('48')
  await expect(page.locator('.forecast-time strong')).not.toHaveText(oldTimestamp)
  await expect(page.locator('.slider-row')).toContainText('+48h')
  expect(
    await page
      .locator('.forecast-cell')
      .evaluateAll((items) => items.map((item) => item.getAttribute('fill'))),
  ).not.toEqual(oldColors)
  expect(calls).toBe(0)
  await page.getByRole('button', { name: 'Forecast layer' }).click()
  await expect(page.locator('.forecast-cell').first()).toBeHidden()
  await expect(page.getByRole('button', { name: 'Forecast layer' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  expect(errors).toEqual([])
  await page.screenshot({ path: `test-results/${info.project.name}-demo.png`, fullPage: true })
})
