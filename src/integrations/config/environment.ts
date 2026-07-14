export type ProviderAdapterType = 'mock' | 'amadeus' | 'booking' | 'rentalcars' | 'google-places' | 'openweather' | 'exchange-rate'

export interface ProviderConfig {
  enabled: boolean
  adapter: ProviderAdapterType
  apiKey: string | null
  apiSecret: string | null
  clientId: string | null
  clientSecret: string | null
  baseUrl: string | null
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

function readProviderConfig(prefix: string, defaultAdapter: ProviderAdapterType): ProviderConfig {
  const adapterOverride = prefix === 'WEATHER'
    ? readAdapter('VITE_WEATHER_PROVIDER', readAdapter(`VITE_${prefix}_ADAPTER`, defaultAdapter))
    : prefix === 'FLIGHT'
      ? readAdapter('VITE_FLIGHT_PROVIDER', readAdapter(`VITE_${prefix}_ADAPTER`, defaultAdapter))
      : prefix === 'HOTEL'
        ? readAdapter('VITE_BOOKING_PROVIDER', readAdapter(`VITE_${prefix}_ADAPTER`, defaultAdapter))
        : prefix === 'RENTAL_CAR'
          ? readAdapter('VITE_RENTAL_PROVIDER', readAdapter(`VITE_${prefix}_ADAPTER`, defaultAdapter))
          : readAdapter(`VITE_${prefix}_ADAPTER`, defaultAdapter)

  const apiKey = prefix === 'WEATHER'
    ? readEnv(`VITE_OPENWEATHER_API_KEY`) ?? readEnv(`VITE_${prefix}_API_KEY`)
    : prefix === 'HOTEL'
      ? readEnv(`VITE_BOOKING_API_KEY`) ?? readEnv(`VITE_${prefix}_API_KEY`)
      : prefix === 'RENTAL_CAR'
        ? readEnv(`VITE_RENTAL_API_KEY`) ?? readEnv(`VITE_${prefix}_API_KEY`)
        : readEnv(`VITE_${prefix}_API_KEY`)

  const clientId = prefix === 'FLIGHT'
    ? readEnv(`VITE_AMADEUS_CLIENT_ID`) ?? readEnv(`VITE_${prefix}_CLIENT_ID`)
    : readEnv(`VITE_${prefix}_CLIENT_ID`)
  const clientSecret = prefix === 'FLIGHT'
    ? readEnv(`VITE_AMADEUS_CLIENT_SECRET`) ?? readEnv(`VITE_${prefix}_CLIENT_SECRET`)
    : readEnv(`VITE_${prefix}_CLIENT_SECRET`)

  return {
    enabled: readBool(`VITE_${prefix}_ENABLED`, true),
    adapter: adapterOverride,
    apiKey,
    apiSecret: readEnv(`VITE_${prefix}_API_SECRET`),
    clientId,
    clientSecret,
    baseUrl: readEnv(`VITE_${prefix}_BASE_URL`),
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
