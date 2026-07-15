/**
 * Phase AI — product-level live capability feature flags.
 *
 * Safe defaults: ALL live capabilities OFF.
 * Distinct from Phase W per-adapter flags, but resolves consistently from env.
 * Does not enable any live provider by itself.
 */

export type LiveCapability =
  | 'live_flights'
  | 'live_hotels'
  | 'live_activities'
  | 'live_transport'
  | 'live_payments'

export interface LiveCapabilityFlags {
  liveFlights: boolean
  liveHotels: boolean
  liveActivities: boolean
  liveTransport: boolean
  livePayments: boolean
  /** Master travel live switch (Phase W compatible). */
  liveProvidersMaster: boolean
}

function readEnv(key: string, env?: Record<string, string | undefined>): string | null {
  const fromInput = env?.[key]
  if (fromInput !== undefined && fromInput !== null && String(fromInput) !== '') {
    return String(fromInput)
  }
  try {
    const vite = (import.meta as { env?: Record<string, unknown> }).env?.[key]
    if (vite !== undefined && vite !== null && String(vite) !== '') return String(vite)
  } catch {
    /* ignore */
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    const value = proc?.env?.[key]
    if (value !== undefined && value !== null && value !== '') return String(value)
  } catch {
    /* ignore */
  }
  return null
}

function parseBool(value: string | null, defaultValue: boolean): boolean {
  if (value == null) return defaultValue
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return defaultValue
}

/**
 * Resolve live capability flags. Defaults keep mock payment and live travel OFF.
 */
export function resolveLiveCapabilityFlags(
  env?: Record<string, string | undefined>,
  overrides: Partial<LiveCapabilityFlags> = {},
): LiveCapabilityFlags {
  const master = overrides.liveProvidersMaster
    ?? parseBool(
      readEnv('VITE_LIVE_PROVIDERS_ENABLED', env) ?? readEnv('LIVE_PROVIDERS_ENABLED', env),
      false,
    )

  // Capability flags stay OFF unless explicitly enabled AND master is on (except payments).
  const liveFlights = overrides.liveFlights
    ?? (master && parseBool(readEnv('VITE_LIVE_FLIGHTS_ENABLED', env), false))
  const liveHotels = overrides.liveHotels
    ?? (master && parseBool(readEnv('VITE_LIVE_HOTELS_ENABLED', env), false))
  const liveActivities = overrides.liveActivities
    ?? (master && parseBool(readEnv('VITE_LIVE_ACTIVITIES_ENABLED', env), false))
  const liveTransport = overrides.liveTransport
    ?? (master && parseBool(readEnv('VITE_LIVE_TRANSPORT_ENABLED', env), false))

  // Payments always default OFF regardless of travel master — Phase X freeze.
  const livePayments = overrides.livePayments
    ?? parseBool(readEnv('VITE_LIVE_PAYMENTS_ENABLED', env), false)

  return {
    liveFlights,
    liveHotels,
    liveActivities,
    liveTransport,
    livePayments,
    liveProvidersMaster: master,
  }
}

export function isLiveCapabilityEnabled(
  flags: LiveCapabilityFlags,
  capability: LiveCapability,
): boolean {
  switch (capability) {
    case 'live_flights':
      return flags.liveFlights
    case 'live_hotels':
      return flags.liveHotels
    case 'live_activities':
      return flags.liveActivities
    case 'live_transport':
      return flags.liveTransport
    case 'live_payments':
      return flags.livePayments
    default:
      return false
  }
}

export function assertSafeLiveDefaults(flags: LiveCapabilityFlags): {
  ok: boolean
  violations: string[]
} {
  const violations: string[] = []
  if (flags.livePayments) {
    violations.push('live_payments must remain disabled (VITE_PAYMENT_PROVIDER=mock)')
  }
  return { ok: violations.length === 0, violations }
}
