import { getIntegrationConfig } from '../../../../../integrations/config/environment'

export interface BookingComProviderConfig {
  enabled: boolean
  apiKey: string | null
  rapidApiHost: string
  baseUrl: string
  timeoutMs: number
  maxRetries: number
}

const DEFAULT_HOST = 'booking-com15.p.rapidapi.com'

function readViteEnv(key: string): string | null {
  try {
    const value = (import.meta as { env?: Record<string, unknown> }).env?.[key]
    if (value === undefined || value === null || value === '') return null
    return String(value)
  } catch {
    return null
  }
}

function readProcessEnv(key: string): string | null {
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    const value = proc?.env?.[key]
    if (value === undefined || value === null || value === '') return null
    return String(value)
  } catch {
    return null
  }
}

/**
 * Resolve Booking.com adapter config from RapidAPI / hotel integration settings.
 * Prefers server-side RAPIDAPI_KEY / BOOKING_RAPIDAPI_KEY over VITE_* when present.
 */
export function resolveBookingComProviderConfig(
  overrides: Partial<BookingComProviderConfig> = {},
): BookingComProviderConfig {
  const integration = getIntegrationConfig().hotel
  const apiKey = overrides.apiKey !== undefined
    ? overrides.apiKey
    : (readProcessEnv('RAPIDAPI_KEY')
      ?? readProcessEnv('BOOKING_RAPIDAPI_KEY')
      ?? integration.apiKey
      ?? readViteEnv('VITE_RAPIDAPI_KEY')
      ?? readViteEnv('VITE_BOOKING_API_KEY'))

  const rapidApiHost = overrides.rapidApiHost
    ?? integration.host
    ?? readViteEnv('VITE_BOOKING_HOST')
    ?? DEFAULT_HOST

  const baseUrl = overrides.baseUrl
    ?? integration.baseUrl
    ?? readViteEnv('VITE_HOTEL_BASE_URL')
    ?? `https://${rapidApiHost}/api/v1`

  const providerSelected = integration.adapter === 'booking'
    || readViteEnv('VITE_BOOKING_PROVIDER') === 'booking'
    || Boolean(apiKey && integration.adapter !== 'mock')

  return {
    enabled: overrides.enabled ?? (integration.enabled && providerSelected),
    apiKey: apiKey ?? null,
    rapidApiHost,
    baseUrl,
    timeoutMs: overrides.timeoutMs ?? integration.timeout ?? 5_000,
    maxRetries: overrides.maxRetries ?? integration.maxRetries ?? 2,
  }
}

export function isBookingComConfigured(config: BookingComProviderConfig): boolean {
  return Boolean(config.enabled && config.apiKey)
}
