/**
 * npm run preview:verify — preview deployment env gate.
 * Values mirror `.env.preview.example` (mock payments, live providers OFF).
 */

import { describe, expect, it } from 'vitest'
import { verifyPreviewEnvironment } from '../ops/preview/previewEnvCheck'

/** Contract aligned with `.env.preview.example` */
const PREVIEW_EXAMPLE_ENV = {
  VITE_DEPLOY_TARGET: 'preview',
  VITE_SUPABASE_URL: 'https://your-preview-project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'your-preview-anon-key',
  VITE_PAYMENT_PROVIDER: 'mock',
  VITE_LIVE_PROVIDERS_ENABLED: 'false',
  VITE_PROVIDER_MOCK_FALLBACK: 'true',
  VITE_AMADEUS_ENABLED: 'false',
  VITE_FLIGHT_PROVIDER: 'mock',
  VITE_FLIGHT_ADAPTER: 'mock',
  VITE_HOTEL_ADAPTER: 'mock',
  VITE_BOOKING_PROVIDER: 'mock',
  VITE_MAPS_PROVIDER: 'mock',
  VITE_WEATHER_PROVIDER: 'mock',
  VITE_WEATHER_ADAPTER: 'mock',
}

describe('preview:verify', () => {
  it('passes against .env.preview.example defaults', () => {
    const result = verifyPreviewEnvironment({ env: PREVIEW_EXAMPLE_ENV })
    // eslint-disable-next-line no-console
    console.log(result.report)
    expect(result.ok).toBe(true)
    expect(result.resolved.paymentProvider).toBe('mock')
    expect(result.resolved.liveProvidersEnabled).toBe(false)
    expect(result.resolved.mockFallbackEnabled).toBe(true)
    expect(result.report).toContain('preview:verify OK')
  })

  it('fails when live providers are enabled', () => {
    const result = verifyPreviewEnvironment({
      env: { ...PREVIEW_EXAMPLE_ENV, VITE_LIVE_PROVIDERS_ENABLED: 'true' },
    })
    expect(result.ok).toBe(false)
    expect(result.report).toContain('preview:verify FAILED')
  })

  it('fails when payment provider is not mock', () => {
    const result = verifyPreviewEnvironment({
      env: { ...PREVIEW_EXAMPLE_ENV, VITE_PAYMENT_PROVIDER: 'moyasar' },
    })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => /mock/i.test(e))).toBe(true)
  })
})
