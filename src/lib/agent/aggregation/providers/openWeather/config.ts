/**
 * OpenWeather provider configuration.
 *
 * API keys are never read from VITE_* variables. Browser clients call the
 * `openweather-proxy` Edge Function; the secret remains server-side.
 */

export interface OpenWeatherProviderConfig {
  /** Server-side OpenWeather API key (never from VITE_*). */
  apiKey: string | null
  /** Edge Function / proxy URL for SPA requests. */
  proxyUrl: string | null
  /** Bearer token for invoking the proxy (typically Supabase anon key). */
  invokeApiKey: string | null
  baseUrl: string
  /** True when the adapter should attempt live OpenWeather. */
  enabled: boolean
  timeoutMs: number
  maxRetries: number
}

const DEFAULT_BASE = 'https://api.openweathermap.org/data/2.5'

function readProcessEnv(name: string): string | null {
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    const value = proc?.env?.[name]
    if (value === undefined || value === null || value === '') return null
    return String(value)
  } catch {
    return null
  }
}

function readViteEnv(name: string): string | null {
  try {
    const value = (import.meta as { env?: Record<string, unknown> }).env?.[name]
    if (value === undefined || value === null || value === '') return null
    return String(value).trim() || null
  } catch {
    return null
  }
}

/**
 * Resolve OpenWeather credentials.
 *
 * - `OPENWEATHER_API_KEY` — server / Edge / Node tests only (never VITE_*)
 * - `OPENWEATHER_PROXY_URL` / `VITE_OPENWEATHER_PROXY_URL` — SPA proxy endpoint only
 * - `VITE_WEATHER_PROVIDER=openweather|mock` — selection preference
 */
export function resolveOpenWeatherProviderConfig(
  overrides: Partial<OpenWeatherProviderConfig> = {},
): OpenWeatherProviderConfig {
  const apiKey = overrides.apiKey !== undefined
    ? overrides.apiKey
    : readProcessEnv('OPENWEATHER_API_KEY')

  const supabaseUrl = readViteEnv('VITE_SUPABASE_URL')
  const defaultProxy = supabaseUrl
    ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/openweather-proxy`
    : null

  const proxyUrl = overrides.proxyUrl !== undefined
    ? overrides.proxyUrl
    : (readProcessEnv('OPENWEATHER_PROXY_URL')
      || readViteEnv('VITE_OPENWEATHER_PROXY_URL')
      || defaultProxy)

  const invokeApiKey = overrides.invokeApiKey !== undefined
    ? overrides.invokeApiKey
    : (readProcessEnv('OPENWEATHER_INVOKE_KEY')
      || readViteEnv('VITE_SUPABASE_ANON_KEY')
      || readViteEnv('VITE_SUPABASE_PUBLISHABLE_KEY'))

  const preferRaw = (
    readProcessEnv('WEATHER_PROVIDER')
    || readViteEnv('VITE_WEATHER_PROVIDER')
    || readViteEnv('VITE_WEATHER_ADAPTER')
    || 'openweather'
  ).toLowerCase()

  const preferLive = preferRaw !== 'mock' && preferRaw !== 'openweather_mock'
  const hasCredentials = Boolean(apiKey || (proxyUrl && invokeApiKey))

  const timeoutRaw = Number(
    overrides.timeoutMs
    ?? readProcessEnv('OPENWEATHER_TIMEOUT_MS')
    ?? readViteEnv('VITE_WEATHER_TIMEOUT')
    ?? 10_000,
  )
  const retriesRaw = Number(
    overrides.maxRetries
    ?? readProcessEnv('OPENWEATHER_MAX_RETRIES')
    ?? 2,
  )

  const baseUrl = overrides.baseUrl
    ?? readProcessEnv('OPENWEATHER_BASE_URL')
    ?? readViteEnv('VITE_WEATHER_BASE_URL')
    ?? DEFAULT_BASE

  return {
    apiKey: apiKey ?? null,
    proxyUrl: proxyUrl ?? null,
    invokeApiKey: invokeApiKey ?? null,
    baseUrl,
    enabled: overrides.enabled ?? (preferLive && hasCredentials),
    timeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 10_000,
    maxRetries: Number.isFinite(retriesRaw) && retriesRaw >= 0 ? Math.floor(retriesRaw) : 2,
  }
}

export function isOpenWeatherConfigured(config: OpenWeatherProviderConfig): boolean {
  return Boolean(
    config.enabled
    && (config.apiKey || (config.proxyUrl && config.invokeApiKey)),
  )
}
