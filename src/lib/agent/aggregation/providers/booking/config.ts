import { getIntegrationConfig } from '../../../../../integrations/config/environment'
import { readManagedConfig, readManagedEnv } from '../../../../security/secrets/managedAccess'

export interface BookingComProviderConfig {
  enabled: boolean
  apiKey: string | null
  rapidApiHost: string
  baseUrl: string
  timeoutMs: number
  maxRetries: number
}

const DEFAULT_HOST = 'booking-com15.p.rapidapi.com'

/**
 * Resolve Booking.com adapter config via SecretManager-backed managed access.
 */
export function resolveBookingComProviderConfig(
  overrides: Partial<BookingComProviderConfig> = {},
): BookingComProviderConfig {
  const integration = getIntegrationConfig().hotel
  const apiKey = overrides.apiKey !== undefined
    ? overrides.apiKey
    : (readManagedEnv('BOOKING_API_KEY', { providerId: 'booking' })
      ?? readManagedEnv('RAPIDAPI_KEY', { providerId: 'booking' })
      ?? readManagedEnv('BOOKING_RAPIDAPI_KEY', { providerId: 'booking' })
      ?? integration.apiKey
      ?? readManagedConfig('VITE_RAPIDAPI_KEY')
      ?? readManagedConfig('VITE_BOOKING_API_KEY'))

  const rapidApiHost = overrides.rapidApiHost
    ?? integration.host
    ?? readManagedConfig('VITE_BOOKING_HOST')
    ?? DEFAULT_HOST

  const baseUrl = overrides.baseUrl
    ?? integration.baseUrl
    ?? readManagedConfig('VITE_HOTEL_BASE_URL')
    ?? `https://${rapidApiHost}/api/v1`

  const providerSelected = integration.adapter === 'booking'
    || readManagedConfig('VITE_BOOKING_PROVIDER') === 'booking'
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
