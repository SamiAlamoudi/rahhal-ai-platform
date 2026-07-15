/**
 * Phase AJ — capability-level live feature flags (all OFF by default).
 */

import { resolveLiveCapabilityFlags } from '../../../ops/production/liveCapabilityFlags'
import { enforceSingleLiveCapability } from './exclusivity'
import type {
  CapabilityEnablement,
  ProviderCapability,
  ProviderEnablementFlags,
} from './types'

function readEnv(key: string, env?: Record<string, string | undefined>): string | null {
  const fromInput = env?.[key]
  if (fromInput != null && String(fromInput).trim() !== '') return String(fromInput)
  try {
    const vite = (import.meta as { env?: Record<string, unknown> }).env?.[key]
    if (vite != null && String(vite) !== '') return String(vite)
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

function parseBool(value: string | null, defaultValue: boolean): boolean {
  if (value == null) return defaultValue
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return defaultValue
}

function capabilityLive(
  env: Record<string, string | undefined> | undefined,
  capabilityFlagEnv: string,
  phaseAiLive: boolean,
): boolean {
  // Explicit capability flag wins; Phase AI live.* also counts; default OFF.
  return parseBool(readEnv(capabilityFlagEnv, env), false) || phaseAiLive
}

function resolveProviderSelection(
  env: Record<string, string | undefined> | undefined,
  keys: string[],
  defaultProvider: string,
): string {
  for (const key of keys) {
    const value = readEnv(key, env)?.trim().toLowerCase()
    if (value) return value
  }
  return defaultProvider
}

/**
 * Resolve enablement flags. Defaults keep every live capability OFF.
 * Bridges Phase AI liveCapabilities without enabling payments.
 */
export function resolveProviderEnablementFlags(
  env?: Record<string, string | undefined>,
  overrides: Partial<ProviderEnablementFlags> = {},
): ProviderEnablementFlags {
  const phaseAi = resolveLiveCapabilityFlags(env)
  const masterLive = overrides.masterLive
    ?? parseBool(readEnv('VITE_LIVE_PROVIDERS_ENABLED', env) ?? readEnv('LIVE_PROVIDERS_ENABLED', env), false)

  const capabilities: Record<ProviderCapability, CapabilityEnablement> = {
    flights: overrides.capabilities?.flights ?? {
      live: capabilityLive(env, 'VITE_PROVIDERS_FLIGHTS_LIVE', phaseAi.liveFlights),
      provider: resolveProviderSelection(env, ['VITE_FLIGHTS_PROVIDER', 'VITE_FLIGHT_PROVIDER'], 'mock'),
    },
    hotels: overrides.capabilities?.hotels ?? {
      live: capabilityLive(env, 'VITE_PROVIDERS_HOTELS_LIVE', phaseAi.liveHotels),
      provider: resolveProviderSelection(env, ['VITE_HOTELS_PROVIDER', 'VITE_HOTEL_ADAPTER', 'VITE_BOOKING_PROVIDER'], 'mock'),
    },
    maps: overrides.capabilities?.maps ?? {
      live: capabilityLive(env, 'VITE_PROVIDERS_MAPS_LIVE', false),
      provider: resolveProviderSelection(env, ['VITE_MAPS_PROVIDER'], 'mock'),
    },
    weather: overrides.capabilities?.weather ?? {
      live: capabilityLive(env, 'VITE_PROVIDERS_WEATHER_LIVE', false),
      provider: resolveProviderSelection(env, ['VITE_WEATHER_PROVIDER', 'VITE_WEATHER_ADAPTER'], 'mock'),
    },
    transport: overrides.capabilities?.transport ?? {
      live: capabilityLive(env, 'VITE_PROVIDERS_TRANSPORT_LIVE', phaseAi.liveTransport),
      provider: resolveProviderSelection(env, ['VITE_TRANSPORT_PROVIDER'], 'mock'),
    },
    activities: overrides.capabilities?.activities ?? {
      live: capabilityLive(env, 'VITE_PROVIDERS_ACTIVITIES_LIVE', phaseAi.liveActivities),
      provider: resolveProviderSelection(env, ['VITE_ACTIVITIES_PROVIDER'], 'mock'),
    },
  }

  // Master OFF ⇒ force all capability live flags OFF for selection purposes.
  if (!masterLive) {
    for (const key of Object.keys(capabilities) as ProviderCapability[]) {
      capabilities[key] = { ...capabilities[key], live: false }
    }
  }

  const base: ProviderEnablementFlags = {
    masterLive,
    mockFallbackEnabled: overrides.mockFallbackEnabled
      ?? parseBool(readEnv('VITE_PROVIDER_MOCK_FALLBACK', env) ?? readEnv('PROVIDER_MOCK_FALLBACK', env), true),
    strictLive: overrides.strictLive
      ?? parseBool(readEnv('VITE_PROVIDER_STRICT_LIVE', env) ?? readEnv('PROVIDER_STRICT_LIVE', env), false),
    capabilities,
  }

  // Phase AK — never allow more than one live capability at a time.
  const exclusive = enforceSingleLiveCapability(base, env)
  return {
    ...exclusive.flags,
    allowedLiveCapability: exclusive.allowedLiveCapability,
    exclusivitySuppressed: exclusive.suppressedCapabilities,
  }
}

export function isCapabilityLiveEnabled(
  flags: ProviderEnablementFlags,
  capability: ProviderCapability,
): boolean {
  return flags.masterLive && flags.capabilities[capability]?.live === true
}

/** Map Phase W provider id → capability. */
export function capabilityForLiveProviderId(providerId: string): ProviderCapability | null {
  switch (providerId) {
    case 'amadeus':
      return 'flights'
    case 'booking_com':
      return 'hotels'
    case 'google_maps':
      return 'maps'
    case 'openweather':
      return 'weather'
    case 'transport_mock':
      return 'transport'
    case 'activities_mock':
      return 'activities'
    default:
      return null
  }
}

/** Canonical live provider id for a capability when selected. */
export function defaultLiveProviderForCapability(capability: ProviderCapability): string | null {
  switch (capability) {
    case 'flights':
      return 'amadeus'
    case 'hotels':
      return 'booking_com'
    case 'maps':
      return 'google_maps'
    case 'weather':
      return 'openweather'
    case 'transport':
    case 'activities':
      return null
    default:
      return null
  }
}
