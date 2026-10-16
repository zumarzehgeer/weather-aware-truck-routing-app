import { test as base, expect } from '@playwright/test'

// Browser regressions use demo/provider fixtures; tiles are checked separately with live access.
const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('https://tile.openstreetmap.org/**', (route) => route.abort())
    // Provider-error fixtures target the server endpoint; browser transport tests override this.
    await page.route('**/api/health', (route) =>
      route.fulfill({ json: { status: 'ok', demo_enabled: true, weather_transport: 'server' } }),
    )
    await use(page)
  },
})

export { test, expect }
