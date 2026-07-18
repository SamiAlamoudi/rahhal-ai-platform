import { describe, expect, it } from 'vitest'
import { verifyPreviewEnvironment } from '../ops/preview/previewEnvCheck'
import { validateEnvironment } from '../ops/security/envValidation'

const previewSafe = {
  VITE_DEPLOY_TARGET: 'preview',
  VITE_SUPABASE_URL: 'https://preview-project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'preview-anon-key',
  VITE_PAYMENT_PROVIDER: 'mock',
  VITE_LIVE_PROVIDERS_ENABLED: 'false',
  VITE_PROVIDER_MOCK_FALLBACK: 'true',
  VITE_FLIGHT_PROVIDER: 'mock',
  VITE_HOTEL_ADAPTER: 'mock',
}

describe('preview deployment env check', () => {
  it('accepts preview-safe mock configuration', () => {
    const result = verifyPreviewEnvironment({ env: previewSafe })
    expect(result.ok).toBe(true)
    expect(result.resolved.paymentProvider).toBe('mock')
    expect(result.resolved.liveProvidersEnabled).toBe(false)
    expect(result.resolved.mockFallbackEnabled).toBe(true)
    expect(result.resolved.supabaseConfigured).toBe(true)
    expect(result.report).toContain('preview:verify OK')
  })

  it('rejects non-mock payments for preview', () => {
    const result = verifyPreviewEnvironment({
      env: { ...previewSafe, VITE_PAYMENT_PROVIDER: 'moyasar' },
    })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => /mock/i.test(e))).toBe(true)
  })

  it('rejects live providers for preview', () => {
    const result = verifyPreviewEnvironment({
      env: { ...previewSafe, VITE_LIVE_PROVIDERS_ENABLED: 'true' },
    })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => /live providers/i.test(e))).toBe(true)
  })

  it('requires Supabase URL and anon key', () => {
    const result = verifyPreviewEnvironment({
      env: {
        ...previewSafe,
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_ANON_KEY: '',
      },
    })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => /supabase/i.test(e))).toBe(true)
  })

  it('forbids production deploy target in preview gate', () => {
    const result = verifyPreviewEnvironment({
      env: { ...previewSafe, VITE_DEPLOY_TARGET: 'production' },
    })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => /production/i.test(e))).toBe(true)
  })

  it('validateEnvironment preview target rejects forbidden client secrets', () => {
    const bad = validateEnvironment({
      target: 'preview',
      env: {
        ...previewSafe,
        VITE_MOYASAR_SECRET_KEY: 'sk_test_should_not_ship',
      },
    })
    expect(bad.ok).toBe(false)
    expect(bad.errors.some((e) => e.includes('VITE_MOYASAR_SECRET_KEY'))).toBe(true)
  })
})
