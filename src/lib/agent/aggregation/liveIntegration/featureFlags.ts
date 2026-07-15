/**
 * Phase W — per-provider feature flags.
 * Live adapters stay dark until flagged on; mock fallback is on by default.
 */

export type LiveProviderFlagKey =
  | 'amadeus'
  | 'booking_com'
  | 'google_maps'
  | 'openweather'

export interface ProviderFeatureFlags {
  /** Master switch — when false, all live providers are treated as off. */
  liveIntegrationEnabled: boolean
  /** Automatic fallback to mock adapters when live fails / unavailable. */
  mockFallbackEnabled: boolean
  providers: Record<LiveProviderFlagKey, boolean>
  /** Amadeus host mode when live flights are enabled. */
  amadeusEnvironment: 'sandbox' | 'production' | 'auto'
}

function readEnv(key: string): string | null {
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

function detectAmadeusLive(): boolean {
  return parseBool(readEnv('VITE_AMADEUS_ENABLED'), false)
    || readEnv('VITE_FLIGHT_PROVIDER') === 'amadeus'
    || readEnv('VITE_FLIGHT_ADAPTER') === 'amadeus'
    || parseBool(readEnv('PROVIDER_AMADEUS_LIVE'), false)
}

function detectBookingLive(): boolean {
  const hotelAdapter = readEnv('VITE_HOTEL_ADAPTER') ?? readEnv('VITE_BOOKING_PROVIDER')
  if (hotelAdapter === 'mock') return false
  return parseBool(readEnv('PROVIDER_BOOKING_LIVE'), hotelAdapter === 'booking' || Boolean(readEnv('VITE_RAPIDAPI_KEY') || readEnv('RAPIDAPI_KEY')))
}

function detectMapsLive(): boolean {
  const maps = readEnv('VITE_MAPS_PROVIDER') ?? readEnv('MAPS_PROVIDER')
  if (maps === 'mock') return false
  return parseBool(readEnv('PROVIDER_GOOGLE_MAPS_LIVE'), maps !== 'mock')
}

function detectWeatherLive(): boolean {
  const weather = readEnv('VITE_WEATHER_PROVIDER') ?? readEnv('VITE_WEATHER_ADAPTER') ?? readEnv('WEATHER_PROVIDER')
  if (weather === 'mock') return false
  return parseBool(readEnv('PROVIDER_OPENWEATHER_LIVE'), weather !== 'mock')
}

function detectAmadeusEnvironment(): ProviderFeatureFlags['amadeusEnvironment'] {
  const explicit = (readEnv('AMADEUS_ENV') ?? readEnv('VITE_AMADEUS_ENV') ?? 'auto').toLowerCase()
  if (explicit === 'sandbox' || explicit === 'production') return explicit
  return 'auto'
}

/**
 * Resolve Phase W feature flags from environment.
 * Secrets are never read here — only enablement / selection switches.
 */
export function resolveProviderFeatureFlags(
  overrides: Partial<ProviderFeatureFlags> & {
    providers?: Partial<Record<LiveProviderFlagKey, boolean>>
  } = {},
): ProviderFeatureFlags {
  const providers: Record<LiveProviderFlagKey, boolean> = {
    amadeus: overrides.providers?.amadeus ?? detectAmadeusLive(),
    booking_com: overrides.providers?.booking_com ?? detectBookingLive(),
    google_maps: overrides.providers?.google_maps ?? detectMapsLive(),
    openweather: overrides.providers?.openweather ?? detectWeatherLive(),
  }

  return {
    liveIntegrationEnabled: overrides.liveIntegrationEnabled
      ?? parseBool(readEnv('VITE_LIVE_PROVIDERS_ENABLED') ?? readEnv('LIVE_PROVIDERS_ENABLED'), true),
    mockFallbackEnabled: overrides.mockFallbackEnabled
      ?? parseBool(readEnv('VITE_PROVIDER_MOCK_FALLBACK') ?? readEnv('PROVIDER_MOCK_FALLBACK'), true),
    providers,
    amadeusEnvironment: overrides.amadeusEnvironment ?? detectAmadeusEnvironment(),
  }
}

export function isLiveProviderFlagEnabled(
  flags: ProviderFeatureFlags,
  key: LiveProviderFlagKey,
): boolean {
  if (!flags.liveIntegrationEnabled) return false
  return flags.providers[key] === true
}

/** Map KnownProviderId → feature flag key for live vendors. */
export function liveFlagKeyForProviderId(providerId: string): LiveProviderFlagKey | null {
  switch (providerId) {
    case 'amadeus':
      return 'amadeus'
    case 'booking_com':
      return 'booking_com'
    case 'google_maps':
      return 'google_maps'
    case 'openweather':
      return 'openweather'
    default:
      return null
  }
}

/** Mock counterpart used for automatic fallback. */
export function mockFallbackIdForLiveProvider(providerId: string): string | null {
  switch (providerId) {
    case 'amadeus':
      return 'amadeus_mock'
    case 'booking_com':
      return 'booking_com_mock'
    case 'google_maps':
      return 'google_maps_mock'
    case 'openweather':
      return 'openweather_mock'
    default:
      return null
  }
}
