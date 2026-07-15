/**
 * Google Maps provider configuration.
 *
 * API keys are never read from VITE_* variables. Browser clients call the
 * `google-maps-proxy` Edge Function; the secret remains server-side.
 */

export interface GoogleMapsProviderConfig {
  /** Server-side Google Maps Platform API key (never from VITE_*). */
  apiKey: string | null
  /** Edge Function / proxy URL for SPA requests. */
  proxyUrl: string | null
  /** Bearer token for invoking the proxy (typically Supabase anon key). */
  invokeApiKey: string | null
  /** True when the adapter should attempt live Google Maps. */
  enabled: boolean
  timeoutMs: number
  maxRetries: number
}

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
 * Resolve Google Maps credentials.
 *
 * - `GOOGLE_MAPS_API_KEY` — server / Edge / Node tests only (never VITE_*)
 * - `GOOGLE_MAPS_PROXY_URL` / `VITE_GOOGLE_MAPS_PROXY_URL` — SPA proxy endpoint only
 * - `VITE_MAPS_PROVIDER=google_maps|mock` — selection preference
 */
export function resolveGoogleMapsProviderConfig(
  overrides: Partial<GoogleMapsProviderConfig> = {},
): GoogleMapsProviderConfig {
  const apiKey = overrides.apiKey !== undefined
    ? overrides.apiKey
    : readProcessEnv('GOOGLE_MAPS_API_KEY')

  const supabaseUrl = readViteEnv('VITE_SUPABASE_URL')
  const defaultProxy = supabaseUrl
    ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/google-maps-proxy`
    : null

  const proxyUrl = overrides.proxyUrl !== undefined
    ? overrides.proxyUrl
    : (readProcessEnv('GOOGLE_MAPS_PROXY_URL')
      || readViteEnv('VITE_GOOGLE_MAPS_PROXY_URL')
      || defaultProxy)

  const invokeApiKey = overrides.invokeApiKey !== undefined
    ? overrides.invokeApiKey
    : (readProcessEnv('GOOGLE_MAPS_INVOKE_KEY')
      || readViteEnv('VITE_SUPABASE_ANON_KEY')
      || readViteEnv('VITE_SUPABASE_PUBLISHABLE_KEY'))

  const preferRaw = (
    readProcessEnv('MAPS_PROVIDER')
    || readViteEnv('VITE_MAPS_PROVIDER')
    || 'google_maps'
  ).toLowerCase()

  const preferLive = preferRaw !== 'mock' && preferRaw !== 'google_maps_mock'
  const hasCredentials = Boolean(apiKey || (proxyUrl && invokeApiKey))

  const timeoutRaw = Number(
    overrides.timeoutMs
    ?? readProcessEnv('GOOGLE_MAPS_TIMEOUT_MS')
    ?? readViteEnv('VITE_GOOGLE_MAPS_TIMEOUT_MS')
    ?? 12_000,
  )
  const retriesRaw = Number(
    overrides.maxRetries
    ?? readProcessEnv('GOOGLE_MAPS_MAX_RETRIES')
    ?? readViteEnv('VITE_GOOGLE_MAPS_MAX_RETRIES')
    ?? 2,
  )

  return {
    apiKey: apiKey ?? null,
    proxyUrl: proxyUrl ?? null,
    invokeApiKey: invokeApiKey ?? null,
    enabled: overrides.enabled ?? (preferLive && hasCredentials),
    timeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 12_000,
    maxRetries: Number.isFinite(retriesRaw) && retriesRaw >= 0 ? Math.floor(retriesRaw) : 2,
  }
}

export function isGoogleMapsConfigured(config: GoogleMapsProviderConfig): boolean {
  return Boolean(
    config.enabled
    && (config.apiKey || (config.proxyUrl && config.invokeApiKey)),
  )
}
