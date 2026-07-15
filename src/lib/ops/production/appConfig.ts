/**
 * Phase AI — centralized application configuration.
 * Single typed snapshot for timeouts, retries, rate limits, flags, and CORS.
 */

import type { DeployTarget } from '../security/envValidation'
import {
  resolveLiveCapabilityFlags,
  type LiveCapabilityFlags,
} from './liveCapabilityFlags'
import { DEFAULT_RETRY_POLICIES, type RetryPolicyConfig } from './retryPolicy'

export interface TimeoutConfig {
  /** Default HTTP / request budget (ms). */
  requestMs: number
  /** Trip planning total budget (ms). */
  planningMs: number
  /** Booking orchestration budget (ms). */
  bookingMs: number
  /** Provider call budget (ms). */
  providerMs: number
  /** Health probe budget (ms). */
  healthMs: number
}

export interface RateLimitConfig {
  auth: number
  search: number
  booking: number
  payment: number
  ticketing: number
  notification: number
  ops: number
  tripPlannerCreate: number
  tripPlannerStatus: number
  tripPlannerRetry: number
  tripPlannerCancel: number
  default: number
}

export interface AppConfig {
  target: DeployTarget
  paymentProvider: 'mock' | string
  liveCapabilities: LiveCapabilityFlags
  timeouts: TimeoutConfig
  retries: RetryPolicyConfig
  rateLimits: RateLimitConfig
  corsAllowlist: string[]
  maxRequestBytes: number
  otelEnabled: boolean
  /** Never contains secrets — presence flags only. */
  secretsPresent: {
    supabase: boolean
    amadeus: boolean
    booking: boolean
    maps: boolean
    weather: boolean
    moyasar: boolean
  }
}

function readEnv(key: string, env?: Record<string, string | undefined>): string | null {
  const fromInput = env?.[key]
  if (fromInput != null && String(fromInput) !== '') return String(fromInput)
  try {
    const vite = (import.meta as { env?: Record<string, unknown> }).env?.[key]
    if (vite !== undefined && vite !== null && String(vite) !== '') return String(vite)
  } catch {
    /* ignore */
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    const value = proc?.env?.[key]
    if (value != null && value !== '') return String(value)
  } catch {
    /* ignore */
  }
  return null
}

function parseIntEnv(key: string, fallback: number, env?: Record<string, string | undefined>): number {
  const raw = readEnv(key, env)
  if (raw == null) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function parseBool(value: string | null, defaultValue: boolean): boolean {
  if (value == null) return defaultValue
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return defaultValue
}

function isSet(value: string | null): boolean {
  return Boolean(value && value.trim())
}

const DEFAULT_TIMEOUTS: TimeoutConfig = {
  requestMs: 30_000,
  planningMs: 30_000,
  bookingMs: 20_000,
  providerMs: 8_000,
  healthMs: 2_000,
}

const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  auth: 10,
  search: 60,
  booking: 30,
  payment: 20,
  ticketing: 20,
  notification: 40,
  ops: 120,
  tripPlannerCreate: 20,
  tripPlannerStatus: 120,
  tripPlannerRetry: 10,
  tripPlannerCancel: 30,
  default: 30,
}

export function resolveDeployTarget(env?: Record<string, string | undefined>): DeployTarget {
  const value = (readEnv('VITE_DEPLOY_TARGET', env) ?? 'development').toLowerCase()
  if (value === 'staging' || value === 'production' || value === 'development') return value
  return 'development'
}

/**
 * Build a centralized config snapshot. Secrets themselves are never stored —
 * only boolean presence markers for readiness.
 */
export function loadAppConfig(
  env?: Record<string, string | undefined>,
  overrides: Partial<{
    target: DeployTarget
    liveCapabilities: Partial<LiveCapabilityFlags>
    timeouts: Partial<TimeoutConfig>
    rateLimits: Partial<RateLimitConfig>
  }> = {},
): AppConfig {
  const target = overrides.target ?? resolveDeployTarget(env)
  const paymentProvider = (readEnv('VITE_PAYMENT_PROVIDER', env) ?? 'mock').toLowerCase()
  const liveCapabilities = resolveLiveCapabilityFlags(env, overrides.liveCapabilities)

  return {
    target,
    paymentProvider,
    liveCapabilities,
    timeouts: {
      requestMs: overrides.timeouts?.requestMs ?? parseIntEnv('VITE_REQUEST_TIMEOUT_MS', DEFAULT_TIMEOUTS.requestMs, env),
      planningMs: overrides.timeouts?.planningMs ?? parseIntEnv('VITE_PLANNING_TIMEOUT_MS', DEFAULT_TIMEOUTS.planningMs, env),
      bookingMs: overrides.timeouts?.bookingMs ?? parseIntEnv('VITE_BOOKING_TIMEOUT_MS', DEFAULT_TIMEOUTS.bookingMs, env),
      providerMs: overrides.timeouts?.providerMs ?? parseIntEnv('VITE_PROVIDER_TIMEOUT_MS', DEFAULT_TIMEOUTS.providerMs, env),
      healthMs: overrides.timeouts?.healthMs ?? parseIntEnv('VITE_HEALTH_TIMEOUT_MS', DEFAULT_TIMEOUTS.healthMs, env),
    },
    retries: { ...DEFAULT_RETRY_POLICIES },
    rateLimits: { ...DEFAULT_RATE_LIMITS, ...overrides.rateLimits },
    corsAllowlist: (readEnv('VITE_CORS_ALLOWLIST', env) ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    maxRequestBytes: parseIntEnv('VITE_MAX_REQUEST_BYTES', 256 * 1024, env),
    otelEnabled: parseBool(readEnv('VITE_OTEL_ENABLED', env), false),
    secretsPresent: {
      supabase: isSet(readEnv('VITE_SUPABASE_URL', env)) && isSet(readEnv('VITE_SUPABASE_ANON_KEY', env)),
      // Server-side secret presence only — VITE_* secrets are rejected by env validation.
      amadeus: isSet(readEnv('AMADEUS_CLIENT_ID', env)) && isSet(readEnv('AMADEUS_CLIENT_SECRET', env)),
      booking: isSet(readEnv('RAPIDAPI_KEY', env)) || isSet(readEnv('BOOKING_API_KEY', env)),
      maps: isSet(readEnv('GOOGLE_MAPS_API_KEY', env)),
      weather: isSet(readEnv('OPENWEATHER_API_KEY', env)),
      moyasar: isSet(readEnv('MOYASAR_SECRET_KEY', env)),
    },
  }
}

let cachedConfig: AppConfig | null = null

export function getAppConfig(): AppConfig {
  if (!cachedConfig) cachedConfig = loadAppConfig()
  return cachedConfig
}

export function resetAppConfig(): void {
  cachedConfig = null
}

export function setAppConfigForTests(config: AppConfig): void {
  cachedConfig = config
}
