/**
 * Google Maps Platform proxy.
 *
 * Holds GOOGLE_MAPS_API_KEY server-side only and forwards Geocoding / Places /
 * Distance Matrix / Timezone requests. The SPA must never see the API key.
 *
 * Deploy secrets (Supabase Edge Function secrets, not VITE_*):
 *   GOOGLE_MAPS_API_KEY=...
 *   EDGE_ALLOWED_ORIGINS=...
 *   SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
 *
 * Request body:
 *   { operation: 'geocode' | 'reverse_geocode' | ..., params: { ... } }
 */

import {
  buildCorsHeaders,
  corsPreflightResponse,
  jsonEdgeResponse,
  requireEdgeInvokeAuth,
} from '../_shared/edgeSecurity.ts'

const ENDPOINTS: Record<string, string> = {
  geocode: 'https://maps.googleapis.com/maps/api/geocode/json',
  reverse_geocode: 'https://maps.googleapis.com/maps/api/geocode/json',
  place_search: 'https://maps.googleapis.com/maps/api/place/textsearch/json',
  place_details: 'https://maps.googleapis.com/maps/api/place/details/json',
  autocomplete: 'https://maps.googleapis.com/maps/api/place/autocomplete/json',
  distance_matrix: 'https://maps.googleapis.com/maps/api/distancematrix/json',
  timezone: 'https://maps.googleapis.com/maps/api/timezone/json',
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req, { methods: ['POST', 'OPTIONS'] })

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req, { methods: ['POST', 'OPTIONS'] })
  }

  if (req.method !== 'POST') {
    return jsonEdgeResponse({ error: 'Method not allowed' }, 405, cors)
  }

  const authError = requireEdgeInvokeAuth(req, cors)
  if (authError) return authError

  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
  if (!apiKey) {
    return jsonEdgeResponse({
      error: 'Google Maps API key is not configured on the server',
      code: 'GOOGLE_MAPS_SERVER_NOT_CONFIGURED',
    }, 503, cors)
  }

  let payload: { operation?: string; params?: Record<string, string | number> }
  try {
    payload = await req.json()
  } catch {
    return jsonEdgeResponse({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, 400, cors)
  }

  const operation = String(payload.operation ?? '')
  const endpoint = ENDPOINTS[operation]
  if (!endpoint) {
    return jsonEdgeResponse({
      error: `Unsupported operation: ${operation}`,
      code: 'UNSUPPORTED_OPERATION',
    }, 400, cors)
  }

  const params = payload.params ?? {}
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value))
  }
  search.set('key', apiKey)

  try {
    const response = await fetch(`${endpoint}?${search.toString()}`)
    const text = await response.text()
    if (response.status === 429) {
      return jsonEdgeResponse({ error: 'rate_limited', status: 'OVER_QUERY_LIMIT' }, 429, cors)
    }
    return new Response(text, {
      status: response.ok ? 200 : response.status === 403 ? 502 : response.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return jsonEdgeResponse({
      error: error instanceof Error ? error.message : 'Upstream request failed',
      code: 'GOOGLE_MAPS_UPSTREAM_ERROR',
    }, 502, cors)
  }
})
