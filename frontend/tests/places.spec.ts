import { test, expect } from './fixtures'

test('empty city search and request failures are visible', async ({ page }) => {
  await page.route('**/api/geocode*', (route) => route.fulfill({ json: { results: [] } }))
  await page.goto('/')
  await page.getByLabel('Origin', { exact: true }).fill('Zzzunknown')
  await expect(page.getByText('No places found. Try a city name.')).toBeVisible()
  await page.getByRole('button', { name: 'Compare routes', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Select an origin and destination')
  await page.unroute('**/api/geocode*')
  await page.route('**/api/geocode*', (route) =>
    route.fulfill({
      status: 502,
      json: { error: { message: 'Place search is unavailable. Check provider access.' } },
    }),
  )
  await page.getByLabel('Origin', { exact: true }).fill('Chicago')
  await expect(page.getByText('Place search is unavailable. Check provider access.')).toBeVisible()
})

test('city suggestions reopen with arrow keys after Escape without refetching', async ({
  page,
}) => {
  let searches = 0
  await page.route('**/api/geocode*', (route) => {
    searches++
    return route.fulfill({
      json: {
        results: [
          { name: 'Boston, Massachusetts, United States', latitude: 42.36, longitude: -71.05 },
          { name: 'Boston, England, United Kingdom', latitude: 52.98, longitude: -0.02 },
        ],
      },
    })
  })
  await page.goto('/')
  const origin = page.getByLabel('Origin', { exact: true })
  await origin.fill('Boston')
  await expect(
    page.getByRole('listbox', { name: 'Origin search results' }).getByRole('option'),
  ).toHaveCount(2)
  await origin.press('ArrowDown')
  await origin.press('Escape')
  await expect(origin).toHaveAttribute('aria-expanded', 'false')
  await expect(origin).not.toHaveAttribute('aria-activedescendant')
  await origin.press('ArrowDown')
  await expect(
    page.getByRole('option', { name: 'Boston, Massachusetts, United States' }),
  ).toHaveAttribute('aria-selected', 'true')
  await origin.press('Escape')
  await origin.press('ArrowUp')
  await expect(
    page.getByRole('option', { name: 'Boston, England, United Kingdom' }),
  ).toHaveAttribute('aria-selected', 'true')
  await origin.press('Enter')
  await expect(origin).toHaveValue('Boston, England, United Kingdom')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  expect(searches).toBe(1)
})

test('swapping clears unresolved text and preserves selected locations', async ({ page }) => {
  await page.route('**/api/geocode*', (route) => route.fulfill({ json: { results: [] } }))
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
  await page.route('**/api/geocode*', (route) => {
    const query = new URL(route.request().url()).searchParams.get('q')
    return route.fulfill({
      json: {
        results:
          query === 'Boston'
            ? [{ name: 'Boston, Massachusetts, United States', latitude: 42.36, longitude: -71.05 }]
            : [{ name: 'Denver, Colorado, United States', latitude: 39.74, longitude: -104.99 }],
      },
    })
  })
  await page.goto('/')
  for (const field of [
    {
      label: 'Origin',
      query: 'Boston',
      result: 'Boston, Massachusetts, United States',
      reset: 'Chicago, Illinois, United States',
    },
    {
      label: 'Destination',
      query: 'Denver',
      result: 'Denver, Colorado, United States',
      reset: 'Detroit, Michigan, United States',
    },
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
