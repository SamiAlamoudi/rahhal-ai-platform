/**
 * Environment / secret validation for startup and readiness probes.
 * Never requires client-side provider secrets.
 * Phase AI — also validates live capability flags and timeout knobs.
 */

import {
  assertSafeLiveDefaults,
  resolveLiveCapabilityFlags,
} from '../production/liveCapabilityFlags'

export type DeployTarget = 'development' | 'staging' | 'production'

export interface EnvironmentValidationInput {
  target?: DeployTarget
  /** from import.meta.env / process.env snapshot */
  env?: Record<string, string | undefined>
  paymentProvider?: string | null
  liveProvidersEnabled?: boolean
}

export interface EnvironmentValidationResult {
  ok: boolean
  target: DeployTarget
  errors: string[]
  warnings: string[]
  resolved: {
    paymentProvider: string
    liveProvidersEnabled: boolean
    supabaseConfigured: boolean
    liveCapabilities: {
      flights: boolean
      hotels: boolean
      activities: boolean
      transport: boolean
      payments: boolean
    }
  }
  summary: {
    target: DeployTarget
    paymentProvider: string
    liveProvidersEnabled: boolean
    errorCount: number
    warningCount: number
  }
}

function readDefaultEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  try {
    const vite = (import.meta as { env?: Record<string, unknown> }).env ?? {}
    for (const [k, v] of Object.entries(vite)) {
      if (typeof v === 'string') out[k] = v
    }
  } catch {
    /* ignore */
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    if (proc?.env) Object.assign(out, proc.env)
  } catch {
    /* ignore */
  }
  return out
}

function isSet(value: string | undefined | null): boolean {
  return Boolean(value && String(value).trim())
}

/**
 * Validate environment for a deploy target.
 * Staging/production require payment mock unless explicitly allowed (never in Phase X).
 * Live provider secrets must not appear in VITE_* keys.
 */
export function validateEnvironment(
  input: EnvironmentValidationInput = {},
): EnvironmentValidationResult {
  const target = input.target ?? 'development'
  const env = { ...readDefaultEnv(), ...input.env }
  const errors: string[] = []
  const warnings: string[] = []

  const paymentProvider = (
    input.paymentProvider
    ?? env.VITE_PAYMENT_PROVIDER
    ?? 'mock'
  ).toLowerCase()

  const liveCapabilities = resolveLiveCapabilityFlags(env)
  const liveProvidersEnabled = input.liveProvidersEnabled
    ?? liveCapabilities.liveProvidersMaster

  const supabaseConfigured = isSet(env.VITE_SUPABASE_URL) && isSet(env.VITE_SUPABASE_ANON_KEY)

  if (target === 'staging' || target === 'production') {
    if (paymentProvider !== 'mock') {
      errors.push('VITE_PAYMENT_PROVIDER must be mock until payment production freeze is lifted')
    }
    if (!supabaseConfigured) {
      warnings.push('Supabase URL/anon key not set — auth/persistence unavailable')
    }
    if (liveProvidersEnabled) {
      warnings.push('Live providers enabled — ensure Edge secrets are configured and feature flags reviewed')
    }
  }

  // Phase AI — live payments must never be on while mock freeze holds.
  const safeLive = assertSafeLiveDefaults({
    ...liveCapabilities,
    livePayments:
      liveCapabilities.livePayments ||
      ['1', 'true', 'yes', 'on'].includes(String(env.VITE_LIVE_PAYMENTS_ENABLED ?? 'false').toLowerCase()),
  })
  if (!safeLive.ok) {
    for (const violation of safeLive.violations) errors.push(violation)
  }
  if (paymentProvider !== 'mock' && (target === 'staging' || target === 'production')) {
    // already errored above
  } else if (liveCapabilities.livePayments && paymentProvider === 'mock') {
    warnings.push('live.payments flag ignored while VITE_PAYMENT_PROVIDER=mock')
  }

  // Timeout knobs must be positive integers when set.
  for (const key of [
    'VITE_REQUEST_TIMEOUT_MS',
    'VITE_PLANNING_TIMEOUT_MS',
    'VITE_BOOKING_TIMEOUT_MS',
    'VITE_PROVIDER_TIMEOUT_MS',
  ]) {
    const raw = env[key]
    if (isSet(raw)) {
      const n = Number.parseInt(String(raw), 10)
      if (!Number.isFinite(n) || n <= 0) {
        errors.push(`${key} must be a positive integer milliseconds value`)
      }
    }
  }

  // Client bundle must never carry provider secrets
  const forbiddenVite = [
    'VITE_AMADEUS_CLIENT_SECRET',
    'VITE_AMADEUS_CLIENT_ID',
    'VITE_OPENWEATHER_API_KEY',
    'VITE_GOOGLE_MAPS_API_KEY',
    'VITE_MOYASAR_SECRET_KEY',
    'VITE_MOYASAR_SECRET',
  ]
  for (const key of forbiddenVite) {
    if (isSet(env[key])) {
      errors.push(`${key} must not be set (provider secrets are server-only)`)
    }
  }

  const ok = errors.length === 0
  return {
    ok,
    target,
    errors,
    warnings,
    resolved: {
      paymentProvider,
      liveProvidersEnabled,
      supabaseConfigured,
      liveCapabilities: {
        flights: liveCapabilities.liveFlights,
        hotels: liveCapabilities.liveHotels,
        activities: liveCapabilities.liveActivities,
        transport: liveCapabilities.liveTransport,
        payments: liveCapabilities.livePayments,
      },
    },
    summary: {
      target,
      paymentProvider,
      liveProvidersEnabled,
      errorCount: errors.length,
      warningCount: warnings.length,
    },
  }
}

/**
 * Fail-fast startup validation. Throws AppError-compatible Error when invalid.
 */
export function assertValidEnvironment(input: EnvironmentValidationInput = {}): EnvironmentValidationResult {
  const result = validateEnvironment(input)
  if (!result.ok) {
    const err = new Error(`Invalid environment configuration: ${result.errors.join('; ')}`)
    err.name = 'EnvironmentValidationError'
    throw err
  }
  return result
}
