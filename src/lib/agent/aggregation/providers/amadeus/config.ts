import { AMADEUS_DEFAULT_HOST, normalizeAmadeusHost } from '../../../../../integrations/providers/amadeus/amadeusHost'
import { getIntegrationConfig } from '../../../../../integrations/config/environment'

export type AmadeusEnvironment = 'sandbox' | 'production'

export interface AmadeusProviderConfig {
  enabled: boolean
  /** Amadeus OAuth client id (server/test only — never VITE_*). */
  clientId: string | null
  /** Amadeus OAuth client secret (server/test only — never VITE_*). */
  clientSecret: string | null
  /** SPA token proxy URL when client secrets are not available in-browser. */
  tokenUrl: string | null
  /** Key used to invoke the token proxy (e.g. Supabase anon key). */
  invokeApiKey: string | null
  /** Amadeus API host (sandbox or production). */
  baseUrl: string
  environment: AmadeusEnvironment
  timeoutMs: number
  maxRetries: number
}

const PRODUCTION_HOST = 'https://api.amadeus.com'
const SANDBOX_HOST = AMADEUS_DEFAULT_HOST

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

function readViteEnv(key: string): string | null {
  try {
    const value = (import.meta as { env?: Record<string, unknown> }).env?.[key]
    if (value === undefined || value === null || value === '') return null
    return String(value)
  } catch {
    return null
  }
}

export function resolveAmadeusEnvironment(baseUrl: string): AmadeusEnvironment {
  const host = normalizeAmadeusHost(baseUrl).toLowerCase()
  if (host.includes('test.api.amadeus.com')) return 'sandbox'
  if (host === 'https://api.amadeus.com' || host.endsWith('://api.amadeus.com')) return 'production'
  return host.includes('test') ? 'sandbox' : 'production'
}

/**
 * Resolve Amadeus adapter config from AMADEUS_* secrets (server/test),
 * integration SPA proxy settings, and sandbox/production host selection.
 */
export function resolveAmadeusProviderConfig(
  overrides: Partial<AmadeusProviderConfig> = {},
): AmadeusProviderConfig {
  const integration = getIntegrationConfig().flight
  const clientId = overrides.clientId ?? readProcessEnv('AMADEUS_CLIENT_ID')
  const clientSecret = overrides.clientSecret ?? readProcessEnv('AMADEUS_CLIENT_SECRET')

  const envSwitch = String(
    overrides.environment
    ?? readProcessEnv('AMADEUS_ENV')
    ?? readViteEnv('VITE_AMADEUS_ENV')
    ?? 'auto',
  ).toLowerCase()

  const explicitBase = overrides.baseUrl
    ?? (envSwitch === 'production' ? PRODUCTION_HOST : null)
    ?? (envSwitch === 'sandbox' ? SANDBOX_HOST : null)
    ?? readProcessEnv('AMADEUS_BASE_URL')
    ?? readViteEnv('VITE_AMADEUS_BASE_URL')
    ?? readViteEnv('VITE_FLIGHT_BASE_URL')
    ?? integration.baseUrl

  const baseUrl = normalizeAmadeusHost(explicitBase || SANDBOX_HOST)
  const environment = resolveAmadeusEnvironment(baseUrl)

  const providerSelected = integration.adapter === 'amadeus'
    || readViteEnv('VITE_AMADEUS_ENABLED') === 'true'
    || Boolean(clientId && clientSecret)

  return {
    enabled: overrides.enabled ?? providerSelected,
    clientId: clientId ?? null,
    clientSecret: clientSecret ?? null,
    tokenUrl: overrides.tokenUrl !== undefined ? overrides.tokenUrl : integration.tokenUrl,
    invokeApiKey: overrides.invokeApiKey !== undefined ? overrides.invokeApiKey : integration.invokeApiKey,
    baseUrl,
    environment,
    timeoutMs: overrides.timeoutMs ?? integration.timeout ?? 5_000,
    maxRetries: overrides.maxRetries ?? integration.maxRetries ?? 2,
  }
}

export function isAmadeusConfigured(config: AmadeusProviderConfig): boolean {
  if (!config.enabled) return false
  const hasClientCredentials = Boolean(config.clientId && config.clientSecret)
  const hasProxy = Boolean(config.tokenUrl && config.invokeApiKey)
  return hasClientCredentials || hasProxy
}

export { SANDBOX_HOST, PRODUCTION_HOST }
