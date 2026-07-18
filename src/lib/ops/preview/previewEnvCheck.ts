/**
 * Preview deployment environment gate (Production MVP).
 * Preview-only — never enables production payments or live providers.
 */

import { validateEnvironment, type EnvironmentValidationResult } from '../security/envValidation'

export interface PreviewEnvCheckInput {
  env?: Record<string, string | undefined>
}

export interface PreviewEnvCheckResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  validation: EnvironmentValidationResult
  resolved: {
    deployTarget: string
    paymentProvider: string
    liveProvidersEnabled: boolean
    mockFallbackEnabled: boolean
    supabaseConfigured: boolean
  }
  report: string
}

function isTruthy(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase())
}

function isSet(value: string | undefined | null): boolean {
  return Boolean(value && String(value).trim())
}

/**
 * Strict preview readiness: mock payment, live providers OFF, mock fallback ON,
 * Supabase URL + anon key present, no forbidden client secrets.
 * Does not deploy; config gate only.
 */
export function verifyPreviewEnvironment(
  input: PreviewEnvCheckInput = {},
): PreviewEnvCheckResult {
  const env = { ...(input.env ?? {}) }
  const errors: string[] = []
  const warnings: string[] = []

  const deployTarget = String(env.VITE_DEPLOY_TARGET ?? 'preview').trim().toLowerCase()
  if (deployTarget === 'production') {
    errors.push('Preview gate forbids VITE_DEPLOY_TARGET=production (preview only)')
  } else if (deployTarget !== 'preview' && deployTarget !== 'staging') {
    warnings.push(`VITE_DEPLOY_TARGET=${deployTarget || '(empty)'} — expected preview or staging`)
  }

  const paymentProvider = String(env.VITE_PAYMENT_PROVIDER ?? 'mock').trim().toLowerCase()
  const liveProvidersEnabled = isTruthy(env.VITE_LIVE_PROVIDERS_ENABLED)
  const mockFallbackRaw = env.VITE_PROVIDER_MOCK_FALLBACK
  const mockFallbackEnabled = mockFallbackRaw == null ? true : isTruthy(mockFallbackRaw)
  const supabaseConfigured = isSet(env.VITE_SUPABASE_URL) && isSet(env.VITE_SUPABASE_ANON_KEY)

  if (paymentProvider !== 'mock') {
    errors.push('VITE_PAYMENT_PROVIDER must be mock for preview deployment')
  }
  if (liveProvidersEnabled) {
    errors.push('VITE_LIVE_PROVIDERS_ENABLED must be false for preview deployment')
  }
  if (!mockFallbackEnabled) {
    errors.push('VITE_PROVIDER_MOCK_FALLBACK must be true for preview deployment')
  }
  if (!supabaseConfigured) {
    errors.push('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required for preview auth')
  }

  const validation = validateEnvironment({
    target: 'preview',
    paymentProvider,
    liveProvidersEnabled,
    env: {
      ...env,
      VITE_PAYMENT_PROVIDER: paymentProvider,
      VITE_LIVE_PROVIDERS_ENABLED: liveProvidersEnabled ? 'true' : 'false',
    },
  })

  for (const err of validation.errors) {
    if (!errors.includes(err)) errors.push(err)
  }
  for (const warn of validation.warnings) {
    if (!warnings.includes(warn)) warnings.push(warn)
  }

  const ok = errors.length === 0 && validation.ok
  const lines = [
    'Rahhal preview environment check',
    `deployTarget=${deployTarget}`,
    `paymentProvider=${paymentProvider}`,
    `liveProvidersEnabled=${liveProvidersEnabled}`,
    `mockFallbackEnabled=${mockFallbackEnabled}`,
    `supabaseConfigured=${supabaseConfigured}`,
    '',
  ]
  if (errors.length) {
    lines.push('Errors:')
    for (const err of errors) lines.push(`  - ${err}`)
    lines.push('')
  }
  if (warnings.length) {
    lines.push('Warnings:')
    for (const warn of warnings) lines.push(`  - ${warn}`)
    lines.push('')
  }
  lines.push(ok ? 'preview:verify OK' : 'preview:verify FAILED')

  return {
    ok,
    errors,
    warnings,
    validation,
    resolved: {
      deployTarget,
      paymentProvider,
      liveProvidersEnabled,
      mockFallbackEnabled,
      supabaseConfigured,
    },
    report: lines.join('\n'),
  }
}
