import { AMADEUS_DEFAULT_HOST } from '../providers/amadeus/amadeusHost'

export type ProviderAdapterType = 'mock' | 'amadeus' | 'booking' | 'rentalcars' | 'google-places' | 'openweather' | 'exchange-rate'

export interface ProviderConfig {
  enabled: boolean
  adapter: ProviderAdapterType
  apiKey: string | null
  apiSecret: string | null
  clientId: string | null
  clientSecret: string | null
  baseUrl: string | null
  /** RapidAPI host header value (e.g. booking-com15.p.rapidapi.com). */
  host: string | null
  /**
   * Server-side Amadeus OAuth token proxy URL (Supabase Edge Function).
   * Never point this at Amadeus directly with a client secret in the SPA.
   */
  tokenUrl: string | null
  /** Key used to invoke the token proxy (Supabase anon key) — not an Amadeus secret. */
  invokeApiKey: string | null
  /** Privileged provider proxy URL (booking / weather) — SPA path only. */
  proxyUrl: string | null
  timeout: number
  maxRetries: number
}

export interface IntegrationConfig {
  flight: ProviderConfig
  hotel: ProviderConfig
  activity: ProviderConfig
  transfer: ProviderConfig
  rentalCar: ProviderConfig
  weather: ProviderConfig
  visa: ProviderConfig
  currency: ProviderConfig
}

function readEnv(key: string): string | null {
  const value = import.meta.env[key]
  if (value === undefined || value === null || value === '') return null
  return String(value)
}

function readBool(key: string, fallback: boolean): boolean {
  const v = readEnv(key)
  if (v === null) return fallback
  return v === 'true' || v === '1'
}

function readInt(key: string, fallback: number): number {
  const v = readEnv(key)
  if (v === null) return fallback
  const n = parseInt(v, 10)
  return isNaN(n) ? fallback : n
}

function readAdapter(key: string, fallback: ProviderAdapterType): ProviderAdapterType {
  const v = readEnv(key)
  if (v === null) return fallback
  const valid: ProviderAdapterType[] = ['mock', 'amadeus', 'booking', 'rentalcars', 'google-places', 'openweather', 'exchange-rate']
  return valid.includes(v as ProviderAdapterType) ? (v as ProviderAdapterType) : fallback
}

const DEFAULT_BOOKING_HOST = 'booking-com15.p.rapidapi.com'
const AMADEUS_TOKEN_FUNCTION_PATH = '/functions/v1/amadeus-token'
/** Same-origin Vercel Edge / Vite middleware token proxy (reads server AMADEUS_* secrets). */
export const AMADEUS_VERCEL_TOKEN_PATH = '/api/amadeus-token'

function isRelativeTokenUrl(url: string): boolean {
  return url.startsWith('/')
}

function resolveAmadeusTokenUrl(): string | null {
  const explicit = readEnv('VITE_AMADEUS_TOKEN_URL')
  if (explicit) return explicit

  // Prefer same-origin Vercel Edge proxy when Amadeus is opted in.
  // Secrets live in Vercel env (AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET).
  const amadeusOptIn = readBool('VITE_AMADEUS_ENABLED', false)
    || readEnv('VITE_FLIGHT_PROVIDER') === 'amadeus'
    || readEnv('VITE_FLIGHT_ADAPTER') === 'amadeus'
  const useVercelProxy = readBool('VITE_AMADEUS_USE_VERCEL_PROXY', true)
  if (amadeusOptIn && useVercelProxy) {
    return AMADEUS_VERCEL_TOKEN_PATH
  }

  const supabaseUrl = readEnv('VITE_SUPABASE_URL')
  if (!supabaseUrl) return null
  return `${supabaseUrl.replace(/\/+$/, '')}${AMADEUS_TOKEN_FUNCTION_PATH}`
}

function hasAmadeusTokenProxy(): boolean {
  const tokenUrl = resolveAmadeusTokenUrl()
  if (!tokenUrl) return false
  // Same-origin Vercel/Vite proxy does not need a Supabase anon key.
  if (isRelativeTokenUrl(tokenUrl)) return true
  const invokeApiKey = readEnv('VITE_SUPABASE_ANON_KEY')
  return Boolean(invokeApiKey)
}

function readHotelAdapter(defaultAdapter: ProviderAdapterType): ProviderAdapterType {
  // Explicit adapter wins when set.
  const bookingProvider = readEnv('VITE_BOOKING_PROVIDER')
  if (bookingProvider !== null) {
    return readAdapter('VITE_BOOKING_PROVIDER', defaultAdapter)
  }
  const hotelAdapter = readEnv('VITE_HOTEL_ADAPTER')
  if (hotelAdapter !== null) {
    return readAdapter('VITE_HOTEL_ADAPTER', defaultAdapter)
  }
  // Auto-enable Booking.com when the Edge booking proxy is reachable (no client secrets).
  if (hasBookingProxy()) return 'booking'
  return defaultAdapter
}

function resolveBookingProxyUrl(): string | null {
  return readEnv('VITE_BOOKING_PROXY_URL')
}

function hasBookingProxy(): boolean {
  const proxyUrl = resolveBookingProxyUrl()
  if (!proxyUrl) return false
  return Boolean(readEnv('VITE_SUPABASE_ANON_KEY') || readEnv('VITE_SUPABASE_PUBLISHABLE_KEY'))
}

function readFlightAdapter(defaultAdapter: ProviderAdapterType): ProviderAdapterType {
  const flightProvider = readEnv('VITE_FLIGHT_PROVIDER')
  if (flightProvider !== null) {
    return readAdapter('VITE_FLIGHT_PROVIDER', defaultAdapter)
  }
  const flightAdapter = readEnv('VITE_FLIGHT_ADAPTER')
  if (flightAdapter !== null) {
    return readAdapter('VITE_FLIGHT_ADAPTER', defaultAdapter)
  }
  // Auto-enable Amadeus when token proxy is reachable from the SPA
  // (secrets live only on the Edge Function — never VITE_AMADEUS_CLIENT_SECRET).
  if (readBool('VITE_AMADEUS_ENABLED', false) && hasAmadeusTokenProxy()) {
    return 'amadeus'
  }
  return defaultAdapter
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

function readProviderConfig(prefix: string, defaultAdapter: ProviderAdapterType): ProviderConfig {
  const adapterOverride = prefix === 'WEATHER'
    ? readAdapter('VITE_WEATHER_PROVIDER', readAdapter(`VITE_${prefix}_ADAPTER`, defaultAdapter))
    : prefix === 'FLIGHT'
      ? readFlightAdapter(defaultAdapter)
      : prefix === 'HOTEL'
        ? readHotelAdapter(defaultAdapter)
        : prefix === 'RENTAL_CAR'
          ? readAdapter('VITE_RENTAL_PROVIDER', readAdapter(`VITE_${prefix}_ADAPTER`, defaultAdapter))
          : readAdapter(`VITE_${prefix}_ADAPTER`, defaultAdapter)

  // Never read VITE_* provider secrets. Server/tests may use process env keys.
  const apiKey = prefix === 'WEATHER'
    ? readProcessEnv('OPENWEATHER_API_KEY')
    : prefix === 'HOTEL'
      ? (
        readProcessEnv('BOOKING_API_KEY')
        ?? readProcessEnv('RAPIDAPI_KEY')
        ?? readProcessEnv('BOOKING_RAPIDAPI_KEY')
      )
      : prefix === 'RENTAL_CAR'
        ? readProcessEnv('RAPIDAPI_KEY') ?? readProcessEnv('RENTAL_API_KEY')
        : readEnv(`VITE_${prefix}_API_KEY`)

  // Amadeus client_id / client_secret must never be loaded into the SPA.
  const clientId = prefix === 'FLIGHT' ? null : readEnv(`VITE_${prefix}_CLIENT_ID`)
  const clientSecret = prefix === 'FLIGHT' ? null : readEnv(`VITE_${prefix}_CLIENT_SECRET`)

  const bookingHost = prefix === 'HOTEL'
    ? (readEnv('VITE_BOOKING_HOST') ?? DEFAULT_BOOKING_HOST)
    : null

  const baseUrl = prefix === 'HOTEL'
    ? (readEnv(`VITE_${prefix}_BASE_URL`) ?? (bookingHost ? `https://${bookingHost}/api/v1` : null))
    : prefix === 'FLIGHT'
      // Funnel defaults to Amadeus Sandbox host when adapter is amadeus; mock path ignores it.
      ? (readEnv('VITE_AMADEUS_BASE_URL') ?? readEnv(`VITE_${prefix}_BASE_URL`) ?? AMADEUS_DEFAULT_HOST)
      : readEnv(`VITE_${prefix}_BASE_URL`)

  const tokenUrl = prefix === 'FLIGHT' ? resolveAmadeusTokenUrl() : null
  const hotelProxyUrl = prefix === 'HOTEL'
    ? (readEnv('VITE_BOOKING_PROXY_URL')
      || (
        adapterOverride === 'booking' && readEnv('VITE_SUPABASE_URL')
          ? `${readEnv('VITE_SUPABASE_URL')!.replace(/\/+$/, '')}/functions/v1/booking-proxy`
          : null
      ))
    : null

  // Supabase Edge requires anon key; same-origin Vercel proxy does not.
  const invokeApiKey = prefix === 'FLIGHT'
    ? (tokenUrl && isRelativeTokenUrl(tokenUrl)
        ? ''
        : readEnv('VITE_SUPABASE_ANON_KEY'))
    : prefix === 'HOTEL'
      ? readEnv('VITE_SUPABASE_ANON_KEY')
      : null

  return {
    enabled: readBool(`VITE_${prefix}_ENABLED`, true),
    adapter: adapterOverride,
    apiKey,
    apiSecret: readEnv(`VITE_${prefix}_API_SECRET`),
    clientId,
    clientSecret,
    baseUrl,
    host: bookingHost,
    tokenUrl,
    invokeApiKey,
    proxyUrl: hotelProxyUrl,
    timeout: readInt(`VITE_${prefix}_TIMEOUT`, 5000),
    maxRetries: readInt(`VITE_${prefix}_MAX_RETRIES`, 2),
  }
}

let cachedConfig: IntegrationConfig | null = null

export function getIntegrationConfig(): IntegrationConfig {
  if (cachedConfig) return cachedConfig

  cachedConfig = {
    flight: readProviderConfig('FLIGHT', 'mock'),
    hotel: readProviderConfig('HOTEL', 'mock'),
    activity: readProviderConfig('ACTIVITY', 'mock'),
    transfer: readProviderConfig('TRANSFER', 'mock'),
    rentalCar: readProviderConfig('RENTAL_CAR', 'mock'),
    weather: readProviderConfig('WEATHER', 'mock'),
    visa: readProviderConfig('VISA', 'mock'),
    currency: readProviderConfig('CURRENCY', 'mock'),
  }

  return cachedConfig
}

export function clearConfigCache(): void {
  cachedConfig = null
}
