/**
 * Vercel Edge Function — Amadeus OAuth token proxy.
 *
 * Reads AMADEUS_API_KEY / AMADEUS_API_SECRET (or CLIENT_ID/SECRET aliases)
 * from Vercel project env (never VITE_*). SPA calls this same-origin endpoint
 * for short-lived tokens.
 *
 * Sprint 79 P0: authenticated callers only + rate limit + CORS allow-list
 * to prevent anonymous token farming.
 */

import { normalizeAmadeusHost, readAmadeusCredentials } from './_lib/amadeusEnv.js'
import { guardEdgeRequest } from './_lib/edgeGuard.js'

export const config = {
  runtime: 'edge',
}

function json(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export default async function handler(req: Request): Promise<Response> {
  // Strict limit — token minting is expensive and abusable.
  const gate = await guardEdgeRequest(req, { bucket: 'amadeus.token', limit: 10 })
  if (!gate.ok) return gate.response
  const corsHeaders = gate.corsHeaders

  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405, corsHeaders)
  }

  const { clientId, clientSecret, host, hasCredentials } = readAmadeusCredentials(process.env)
  if (!hasCredentials || !clientId || !clientSecret) {
    return json({
      error: 'Amadeus credentials are not configured on the server',
      code: 'AMADEUS_SERVER_NOT_CONFIGURED',
    }, 503, corsHeaders)
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
      return json({
        error: 'Amadeus token exchange failed',
        code: response.status === 401
          ? 'AMADEUS_INVALID_CREDENTIALS'
          : response.status === 429
            ? 'AMADEUS_QUOTA_EXCEEDED'
            : 'AMADEUS_AUTH_ERROR',
        status: response.status,
      }, response.status === 401 || response.status === 429 ? response.status : 502, corsHeaders)
    }

    const data = JSON.parse(text) as Record<string, unknown>
    return json({
      access_token: data.access_token,
      token_type: data.token_type ?? 'Bearer',
      expires_in: data.expires_in,
      scope: data.scope ?? null,
    }, 200, corsHeaders)
  } catch (err) {
    return json({
      error: err instanceof Error ? err.message : 'Token exchange failed',
      code: 'AMADEUS_AUTH_NETWORK',
    }, 502, corsHeaders)
  }
}
