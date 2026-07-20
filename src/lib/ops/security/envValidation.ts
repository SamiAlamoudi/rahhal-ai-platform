/**
 * Environment / secret validation for startup and readiness probes.
 * Never requires client-side provider secrets.
 */

export type DeployTarget = 'development' | 'preview' | 'staging' | 'production'

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

  const liveProvidersEnabled = input.liveProvidersEnabled
    ?? ['1', 'true', 'yes', 'on'].includes(String(env.VITE_LIVE_PROVIDERS_ENABLED ?? 'false').toLowerCase())

  const supabaseConfigured = isSet(env.VITE_SUPABASE_URL) && isSet(env.VITE_SUPABASE_ANON_KEY)

  if (target === 'preview' || target === 'staging' || target === 'production') {
    if (paymentProvider !== 'mock') {
      errors.push('VITE_PAYMENT_PROVIDER must be mock until payment production freeze is lifted')
    }
    if (!supabaseConfigured) {
      if (target === 'preview') {
        errors.push('Supabase URL/anon key required for preview deployment')
      } else {
        warnings.push('Supabase URL/anon key not set — auth/persistence unavailable')
      }
    }
    if (liveProvidersEnabled) {
      if (target === 'preview') {
        errors.push('Live providers must remain disabled for preview deployment')
      } else {
        warnings.push('Live providers enabled — ensure Edge secrets are configured and feature flags reviewed')
      }
    }
  }

  // Client bundle must never carry server-side provider secrets
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

  // RapidAPI hotel keys are still read by the SPA adapter today — warn on hardened targets
  // until a server proxy replaces VITE_* shipping (do not hard-fail; would remove live hotel path).
  const clientBundledApiKeys = ['VITE_RAPIDAPI_KEY', 'VITE_BOOKING_API_KEY']
  if (target === 'preview' || target === 'staging' || target === 'production') {
    for (const key of clientBundledApiKeys) {
      if (isSet(env[key])) {
        warnings.push(`${key} is bundled into the client — prefer a server proxy before production live hotels`)
      }
    }
  }

  if (target === 'production' && liveProvidersEnabled === false) {
    // Safe default — ok
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
