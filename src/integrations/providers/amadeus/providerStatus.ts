/**
 * Client helpers for Amadeus / provider health status.
 * Fetches GET /api/health/providers (Vercel Edge or Vite middleware).
 */

export type AmadeusHealthStatus =
  | 'connected'
  | 'missing_credentials'
  | 'invalid_credentials'
  | 'unreachable'
  | 'error'

export interface ProvidersHealthResponse {
  amadeus: AmadeusHealthStatus
  fallback: boolean
  host?: string
  checkedAt: string
  detail?: string
}

export const PROVIDERS_HEALTH_PATH = '/api/health/providers'

export function isAmadeusConnected(health: ProvidersHealthResponse): boolean {
  return health.amadeus === 'connected' && health.fallback === false
}

export function formatAmadeusStatusLabel(health: ProvidersHealthResponse): string {
  if (isAmadeusConnected(health)) return '✓ Amadeus Connected'
  return '⚠ Running in Mock Mode'
}

export async function fetchProvidersHealth(
  fetchImpl: typeof fetch = fetch,
): Promise<ProvidersHealthResponse> {
  try {
    const response = await fetchImpl(PROVIDERS_HEALTH_PATH, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) {
      return {
        amadeus: 'error',
        fallback: true,
        checkedAt: new Date().toISOString(),
        detail: `Health endpoint HTTP ${response.status}`,
      }
    }
    const data = await response.json() as Partial<ProvidersHealthResponse>
    return {
      amadeus: (data.amadeus as AmadeusHealthStatus) || 'error',
      fallback: data.fallback !== false,
      host: data.host,
      checkedAt: data.checkedAt || new Date().toISOString(),
      detail: data.detail,
    }
  } catch (err) {
    return {
      amadeus: 'unreachable',
      fallback: true,
      checkedAt: new Date().toISOString(),
      detail: err instanceof Error ? err.message : 'Health endpoint unreachable',
    }
  }
}
