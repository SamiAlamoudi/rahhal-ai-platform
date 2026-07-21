/**
 * Shared Amadeus env helpers for Vercel Edge / Node API routes.
 * Secrets must never be exposed to the SPA (no VITE_* for client_secret).
 */

export const AMADEUS_DEFAULT_HOST = 'https://test.api.amadeus.com'
export const AMADEUS_PRODUCTION_HOST = 'https://api.amadeus.com'

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

export function normalizeAmadeusHost(raw: string | undefined | null): string {
  const value = (raw || AMADEUS_DEFAULT_HOST).trim()
  return value.replace(/\/+$/, '').replace(/\/v1$/i, '')
}

export function readAmadeusCredentials(env: Record<string, string | undefined> = process.env): {
  clientId: string | null
  clientSecret: string | null
  host: string
  hasCredentials: boolean
} {
  // Sprint 59: AMADEUS_API_KEY / AMADEUS_API_SECRET preferred;
  // AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET remain supported aliases.
  const clientId =
    (env.AMADEUS_API_KEY || '').trim()
    || (env.AMADEUS_CLIENT_ID || '').trim()
    || null
  const clientSecret =
    (env.AMADEUS_API_SECRET || '').trim()
    || (env.AMADEUS_CLIENT_SECRET || '').trim()
    || null
  const host = normalizeAmadeusHost(env.AMADEUS_BASE_URL)
  return {
    clientId,
    clientSecret,
    host,
    hasCredentials: Boolean(clientId && clientSecret),
  }
}

export function missingCredentialsResponse(): ProvidersHealthResponse {
  return {
    amadeus: 'missing_credentials',
    fallback: true,
    checkedAt: new Date().toISOString(),
    detail:
      'AMADEUS_API_KEY/AMADEUS_API_SECRET (or AMADEUS_CLIENT_ID/AMADEUS_CLIENT_SECRET) are not set on the server',
  }
}

export async function probeAmadeusConnection(
  env: Record<string, string | undefined> = process.env,
): Promise<ProvidersHealthResponse> {
  const { clientId, clientSecret, host, hasCredentials } = readAmadeusCredentials(env)
  const checkedAt = new Date().toISOString()

  if (!hasCredentials || !clientId || !clientSecret) {
    return missingCredentialsResponse()
  }

  const tokenUrl = `${host}/v1/security/oauth2/token`
  try {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    })
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (response.status === 401) {
      return {
        amadeus: 'invalid_credentials',
        fallback: true,
        host,
        checkedAt,
        detail: 'Amadeus rejected the OAuth client credentials',
      }
    }

    if (!response.ok) {
      return {
        amadeus: 'error',
        fallback: true,
        host,
        checkedAt,
        detail: `Amadeus token exchange failed with HTTP ${response.status}`,
      }
    }

    const data = await response.json() as { access_token?: string }
    if (!data.access_token) {
      return {
        amadeus: 'error',
        fallback: true,
        host,
        checkedAt,
        detail: 'Amadeus token response missing access_token',
      }
    }

    return {
      amadeus: 'connected',
      fallback: false,
      host,
      checkedAt,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown network error'
    const unreachable = /fetch|network|ENOTFOUND|EAI_AGAIN|getaddrinfo|Could not resolve/i.test(message)
    return {
      amadeus: unreachable ? 'unreachable' : 'error',
      fallback: true,
      host,
      checkedAt,
      detail: message,
    }
  }
}
