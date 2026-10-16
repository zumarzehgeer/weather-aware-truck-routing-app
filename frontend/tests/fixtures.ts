import { test as base, expect } from '@playwright/test'

// Browser regressions use demo/provider fixtures; tiles are checked separately with live access.
const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('https://tile.openstreetmap.org/**', (route) => route.abort())
    await use(page)
  },
})

export { test, expect }
