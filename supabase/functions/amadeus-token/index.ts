/**
 * Amadeus OAuth token proxy.
 *
 * Holds AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET server-side only and exchanges
 * them for a short-lived access token. The SPA must never see the client secret.
 *
 * Deploy secrets (Supabase Edge Function secrets, not VITE_*):
 *   AMADEUS_CLIENT_ID
 *   AMADEUS_CLIENT_SECRET
 *   AMADEUS_BASE_URL (optional, default https://test.api.amadeus.com)
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_AMADEUS_HOST = 'https://test.api.amadeus.com'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeAmadeusHost(raw: string): string {
  return raw.replace(/\/+$/, '').replace(/\/v1$/i, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const clientId = Deno.env.get('AMADEUS_CLIENT_ID')
  const clientSecret = Deno.env.get('AMADEUS_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    return jsonResponse({
      error: 'Amadeus credentials are not configured on the server',
      code: 'AMADEUS_SERVER_NOT_CONFIGURED',
    }, 503)
  }

  const host = normalizeAmadeusHost(Deno.env.get('AMADEUS_BASE_URL') || DEFAULT_AMADEUS_HOST)
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

    const text = await response.text()
    if (!response.ok) {
      return jsonResponse({
        error: 'Amadeus token exchange failed',
        code: response.status === 401
          ? 'AMADEUS_INVALID_CREDENTIALS'
          : response.status === 429
            ? 'AMADEUS_QUOTA_EXCEEDED'
            : 'AMADEUS_AUTH_ERROR',
        status: response.status,
      }, response.status === 401 || response.status === 429 ? response.status : 502)
    }

    // Forward Amadeus token payload (access_token, token_type, expires_in, scope).
    // Never include client_secret in the response.
    const data = JSON.parse(text) as Record<string, unknown>
    return jsonResponse({
      access_token: data.access_token,
      token_type: data.token_type ?? 'Bearer',
      expires_in: data.expires_in,
      scope: data.scope ?? null,
    })
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Token exchange failed',
      code: 'AMADEUS_AUTH_NETWORK',
    }, 502)
  }
})
