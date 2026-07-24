import { getIntegrationConfig } from '../../../../../integrations/config/environment'

export interface BookingComProviderConfig {
  enabled: boolean
  /** Server-side RapidAPI key (Node/tests). Never from VITE_*. */
  apiKey: string | null
  /** Edge Function / proxy URL for SPA requests. */
  proxyUrl: string | null
  /** Bearer token for invoking the proxy (typically Supabase anon key). */
  invokeApiKey: string | null
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
 * Resolve Booking.com adapter config.
 *
 * Secrets stay server-side:
 *   BOOKING_API_KEY / RAPIDAPI_KEY / BOOKING_RAPIDAPI_KEY (process / Edge)
 * Browser path uses booking-proxy + anon invoke key — never VITE_RAPIDAPI_KEY.
 */
export function resolveBookingComProviderConfig(
  overrides: Partial<BookingComProviderConfig> = {},
): BookingComProviderConfig {
  const integration = getIntegrationConfig().hotel
  const apiKey = overrides.apiKey !== undefined
    ? overrides.apiKey
    : (readProcessEnv('BOOKING_API_KEY')
      ?? readProcessEnv('RAPIDAPI_KEY')
      ?? readProcessEnv('BOOKING_RAPIDAPI_KEY')
      ?? null)

  const supabaseUrl = readViteEnv('VITE_SUPABASE_URL')

  const proxyUrl = overrides.proxyUrl !== undefined
    ? overrides.proxyUrl
    : (readProcessEnv('BOOKING_PROXY_URL')
      || readViteEnv('VITE_BOOKING_PROXY_URL')
      || (
        // Default Edge path only when hotel adapter is explicitly booking.
        (integration.adapter === 'booking' || readViteEnv('VITE_BOOKING_PROVIDER') === 'booking')
        && supabaseUrl
          ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/booking-proxy`
          : null
      ))

  const invokeApiKey = overrides.invokeApiKey !== undefined
    ? overrides.invokeApiKey
    : (readProcessEnv('BOOKING_INVOKE_KEY')
      || readViteEnv('VITE_SUPABASE_ANON_KEY')
      || readViteEnv('VITE_SUPABASE_PUBLISHABLE_KEY'))

  const rapidApiHost = overrides.rapidApiHost
    ?? integration.host
    ?? readViteEnv('VITE_BOOKING_HOST')
    ?? DEFAULT_HOST

  const baseUrl = overrides.baseUrl
    ?? integration.baseUrl
    ?? readViteEnv('VITE_HOTEL_BASE_URL')
    ?? `https://${rapidApiHost}/api/v1`

  const hasCredentials = Boolean(apiKey || (proxyUrl && invokeApiKey))
  const providerSelected = integration.adapter === 'booking'
    || readViteEnv('VITE_BOOKING_PROVIDER') === 'booking'
    || (hasCredentials && integration.adapter !== 'mock')

  return {
    enabled: overrides.enabled ?? (integration.enabled && providerSelected),
    apiKey: apiKey ?? null,
    proxyUrl: proxyUrl ?? null,
    invokeApiKey: invokeApiKey ?? null,
    rapidApiHost,
    baseUrl,
    timeoutMs: overrides.timeoutMs ?? integration.timeout ?? 5_000,
    maxRetries: overrides.maxRetries ?? integration.maxRetries ?? 2,
  }
}

export function isBookingComConfigured(config: BookingComProviderConfig): boolean {
  return Boolean(
    config.enabled
    && (config.apiKey || (config.proxyUrl && config.invokeApiKey)),
  )
}
