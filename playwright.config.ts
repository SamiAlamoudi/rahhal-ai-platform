import { defineConfig, devices } from '@playwright/test'

/**
 * Browser E2E for Production MVP booking funnel.
 * Boots vite preview with demo auth + mock providers (no live secrets).
 * Set VOICE_E2E_BASE_URL to hit a Vercel Preview instead (skips local webServer).
 */
const remoteBase = process.env.VOICE_E2E_BASE_URL?.trim() || ''
const bypass = process.env.VERCEL_PROTECTION_BYPASS?.trim() || ''

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: remoteBase || 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ar-SA',
    ...(remoteBase && bypass
      ? {
          extraHTTPHeaders: {
            'x-vercel-protection-bypass': bypass,
            'x-vercel-set-bypass-cookie': 'true',
          },
        }
      : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(remoteBase
    ? {}
    : {
        webServer: {
          command: 'npm run preview -- --host 127.0.0.1 --port 4173',
          url: 'http://127.0.0.1:4173',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
})
