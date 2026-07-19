/**
 * Sprint 26 — execution provider runtime configuration.
 * Environment-based; no live HTTP unless Phase W + secrets allow it.
 */

export type ExecutionProviderDomain =
  | 'flights'
  | 'hotels'
  | 'transport'
  | 'activities'
  | 'packages'

export type ExecutionProviderMode = 'mock' | 'real' | 'mixed'

export type ProviderHealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'unknown'

export interface DomainProviderConfig {
  domain: ExecutionProviderDomain
  /** Preferred provider id (e.g. amadeus, booking_com, mock_flights). */
  primaryId: string
  /** Fallback provider id when primary fails / unavailable. */
  fallbackId: string
  /** Lower number = higher priority when selecting among peers. */
  priority: number
  timeoutMs: number
  maxRetries: number
  /** When true, prefer real adapter if available; else mock. */
  preferReal: boolean
}

export interface ExecutionProviderRuntimeConfig {
  mode: ExecutionProviderMode
  /** Master: allow real adapters in the execution bundle. */
  realProvidersEnabled: boolean
  /** Phase W live HTTP (orthogonal kill switch). */
  liveHttpEnabled: boolean
  /** Use mock fallback when real fails / unconfigured. */
  mockFallback: boolean
  defaultTimeoutMs: number
  defaultMaxRetries: number
  cacheTtlMs: number
  domains: Record<ExecutionProviderDomain, DomainProviderConfig>
}

export type ResolveExecutionProviderConfigInput = {
  mode?: ExecutionProviderMode
  realProvidersEnabled?: boolean
  liveHttpEnabled?: boolean
  mockFallback?: boolean
  defaultTimeoutMs?: number
  defaultMaxRetries?: number
  cacheTtlMs?: number
  env?: Record<string, string | undefined>
}

function readEnv(
  env: Record<string, string | undefined> | undefined,
  key: string,
): string | undefined {
  if (env && key in env) return env[key]
  try {
    const vite = (import.meta as { env?: Record<string, unknown> }).env?.[key]
    if (vite !== undefined && vite !== null && String(vite) !== '') return String(vite)
  } catch {
    // ignore
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process
    const value = proc?.env?.[key]
    if (value !== undefined && value !== null && value !== '') return String(value)
  } catch {
    // ignore
  }
  return undefined
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return fallback
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (value == null || value === '') return fallback
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function domainDefaults(
  domain: ExecutionProviderDomain,
  preferReal: boolean,
  timeoutMs: number,
  maxRetries: number,
): DomainProviderConfig {
  const primaryByDomain: Record<ExecutionProviderDomain, string> = {
    flights: preferReal ? 'amadeus_flights' : 'mock_flights',
    hotels: preferReal ? 'booking_hotels' : 'mock_hotels',
    transport: preferReal ? 'maps_transport' : 'mock_transport',
    activities: preferReal ? 'real_activities' : 'mock_activities',
    packages: preferReal ? 'real_packages' : 'mock_packages',
  }
  const fallbackByDomain: Record<ExecutionProviderDomain, string> = {
    flights: 'mock_flights',
    hotels: 'mock_hotels',
    transport: 'mock_transport',
    activities: 'mock_activities',
    packages: 'mock_packages',
  }
  const priorityByDomain: Record<ExecutionProviderDomain, number> = {
    flights: 10,
    hotels: 20,
    transport: 30,
    activities: 40,
    packages: 50,
  }
  return {
    domain,
    primaryId: primaryByDomain[domain],
    fallbackId: fallbackByDomain[domain],
    priority: priorityByDomain[domain],
    timeoutMs,
    maxRetries,
    preferReal,
  }
}

/**
 * Resolve runtime provider config from env + optional overrides.
 */
export function resolveExecutionProviderConfig(
  input: ResolveExecutionProviderConfigInput = {},
): ExecutionProviderRuntimeConfig {
  const env = input.env
  const liveHttpEnabled =
    input.liveHttpEnabled ??
    parseBool(
      readEnv(env, 'VITE_LIVE_PROVIDERS_ENABLED') ?? readEnv(env, 'LIVE_PROVIDERS_ENABLED'),
      false,
    )
  const mockFallback =
    input.mockFallback ??
    parseBool(readEnv(env, 'VITE_PROVIDER_MOCK_FALLBACK'), true)

  const mode =
    input.mode ??
    (parseMode(readEnv(env, 'VITE_EXECUTION_PROVIDER_MODE')) ?? 'mock')

  const envReal = parseBool(readEnv(env, 'VITE_BRAIN_REAL_PROVIDERS'), false)
  const realProvidersEnabled =
    input.realProvidersEnabled ??
    (envReal || mode === 'real' || mode === 'mixed')

  const defaultTimeoutMs =
    input.defaultTimeoutMs ??
    parseIntEnv(readEnv(env, 'VITE_PROVIDER_TIMEOUT_MS'), 2000)
  const defaultMaxRetries =
    input.defaultMaxRetries ??
    parseIntEnv(readEnv(env, 'VITE_PROVIDER_MAX_RETRIES'), 1)
  const cacheTtlMs =
    input.cacheTtlMs ??
    parseIntEnv(readEnv(env, 'VITE_PROVIDER_CACHE_TTL_MS'), 60_000)

  const preferReal = Boolean(realProvidersEnabled) && mode !== 'mock'
  const useRealForDomain = (domainMode: 'always' | 'mixedOnly' | 'realOnly') => {
    if (!preferReal) return false
    if (domainMode === 'always') return true
    if (domainMode === 'mixedOnly') return mode === 'mixed' || mode === 'real'
    return mode === 'real'
  }

  const domains: ExecutionProviderRuntimeConfig['domains'] = {
    flights: domainDefaults('flights', useRealForDomain('mixedOnly'), defaultTimeoutMs, defaultMaxRetries),
    hotels: domainDefaults('hotels', useRealForDomain('mixedOnly'), defaultTimeoutMs, defaultMaxRetries),
    transport: domainDefaults(
      'transport',
      useRealForDomain('realOnly'),
      defaultTimeoutMs,
      defaultMaxRetries,
    ),
    activities: domainDefaults(
      'activities',
      useRealForDomain('realOnly'),
      defaultTimeoutMs,
      defaultMaxRetries,
    ),
    packages: domainDefaults(
      'packages',
      useRealForDomain('realOnly'),
      defaultTimeoutMs,
      defaultMaxRetries,
    ),
  }

  // Mixed: real flights/hotels, mock everything else.
  if (mode === 'mixed') {
    domains.flights = domainDefaults('flights', true, defaultTimeoutMs, defaultMaxRetries)
    domains.hotels = domainDefaults('hotels', true, defaultTimeoutMs, defaultMaxRetries)
    domains.transport = domainDefaults('transport', false, defaultTimeoutMs, defaultMaxRetries)
    domains.activities = domainDefaults('activities', false, defaultTimeoutMs, defaultMaxRetries)
    domains.packages = domainDefaults('packages', false, defaultTimeoutMs, defaultMaxRetries)
  }

  return {
    mode,
    realProvidersEnabled: Boolean(realProvidersEnabled),
    liveHttpEnabled,
    mockFallback,
    defaultTimeoutMs,
    defaultMaxRetries,
    cacheTtlMs,
    domains,
  }
}

function parseMode(value: string | undefined): ExecutionProviderMode | null {
  if (!value) return null
  const v = value.trim().toLowerCase()
  if (v === 'mock' || v === 'real' || v === 'mixed') return v
  return null
}
