import { test, expect } from './fixtures'

test('risk guide returns keyboard focus to each opener after Escape or close', async ({
  page,
}, info) => {
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

test('workspace adapts from wide comparison rail to stacked mobile cards', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'One browser covers the responsive widths.')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await expect(page.getByRole('button', { name: 'Select Route C' })).toBeVisible()
  await expect(page.locator('.tile-notice')).toBeVisible()
  for (const width of [1440, 1024, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      `Overflow at ${width}px`,
    ).toBe(true)
    const map = await page.locator('.map-shell').boundingBox()
    const comparison = await page
      .getByRole('region', { name: 'Route comparison', exact: true })
      .boundingBox()
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
      await expect
        .poll(
          async () => {
            const popup = await page.locator('.leaflet-popup').boundingBox()
            const mapBody = await page.locator('.map-body').boundingBox()
            return (
              !!popup &&
              !!mapBody &&
              popup.x >= mapBody.x &&
              popup.x + popup.width <= mapBody.x + mapBody.width &&
              popup.y >= mapBody.y &&
              popup.y + popup.height <= mapBody.y + mapBody.height
            )
          },
          { message: `Popup stays inside the map after panning at ${width}px` },
        )
        .toBe(true)
      await close.click()
      await expect(page.locator('.weather-popup')).toHaveCount(0)
    }
  }
  await page.getByRole('button', { name: 'Risk guide', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})
