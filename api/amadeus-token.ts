/**
 * Vercel Edge Function — Amadeus OAuth token proxy.
 *
 * Reads AMADEUS_API_KEY / AMADEUS_API_SECRET (or CLIENT_ID/SECRET aliases)
 * from Vercel project env (never VITE_*). SPA calls this same-origin endpoint
 * for short-lived tokens.
 *
 * Deploy:
 *   vercel env add AMADEUS_API_KEY
 *   vercel env add AMADEUS_API_SECRET
 *   vercel env add AMADEUS_BASE_URL
 *   vercel env add EDGE_ALLOWED_ORIGINS
 */

import { normalizeAmadeusHost, readAmadeusCredentials } from './_lib/amadeusEnv.js'
import {
  buildCorsHeaders,
  corsPreflightResponse,
  jsonEdgeResponse,
  requireEdgeInvokeAuth,
} from './_lib/edgeSecurity.js'

export const config = {
  runtime: 'edge',
}

export default async function handler(req: Request): Promise<Response> {
  const cors = buildCorsHeaders(req, { methods: ['GET', 'POST', 'OPTIONS'] })

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req, { methods: ['GET', 'POST', 'OPTIONS'] })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonEdgeResponse({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405, cors)
  }

  // Same-origin SPA calls may omit Origin; still accept invoke credentials when present.
  const authError = requireEdgeInvokeAuth(req, cors, process.env, {
    allowMissingWhenNoOrigin: true,
  })
  if (authError) return authError

  const { clientId, clientSecret, host, hasCredentials } = readAmadeusCredentials(process.env)
  if (!hasCredentials || !clientId || !clientSecret) {
    return jsonEdgeResponse({
      error: 'Amadeus credentials are not configured on the server',
      code: 'AMADEUS_SERVER_NOT_CONFIGURED',
    }, 503, cors)
  }

  const tokenUrl = `${normalizeAmadeusHost(host)}/v1/security/oauth2/token`

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

    const text = await response.text()
    if (!response.ok) {
      return jsonEdgeResponse({
        error: 'Amadeus token exchange failed',
        code: response.status === 401
          ? 'AMADEUS_INVALID_CREDENTIALS'
          : response.status === 429
            ? 'AMADEUS_QUOTA_EXCEEDED'
            : 'AMADEUS_AUTH_ERROR',
        status: response.status,
      }, response.status === 401 || response.status === 429 ? response.status : 502, cors)
    }

    const data = JSON.parse(text) as Record<string, unknown>
    return jsonEdgeResponse({
      access_token: data.access_token,
      token_type: data.token_type ?? 'Bearer',
      expires_in: data.expires_in,
      scope: data.scope ?? null,
    }, 200, cors)
  } catch (err) {
    return jsonEdgeResponse({
      error: err instanceof Error ? err.message : 'Token exchange failed',
      code: 'AMADEUS_AUTH_NETWORK',
    }, 502, cors)
  }
}
