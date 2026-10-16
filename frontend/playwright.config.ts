import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'

const python = resolve(
  '..',
  '.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
)
const existingBaseURL = process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: existingBaseURL ?? 'http://127.0.0.1:8000',
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } },
    },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: existingBaseURL
    ? undefined
    : {
        command: `"${python}" ../backend/manage.py collectstatic --noinput && "${python}" ../backend/manage.py runserver 127.0.0.1:8000 --noreload`,
        url: 'http://127.0.0.1:8000/api/health',
        reuseExistingServer: false,
      },
})
