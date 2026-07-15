/**
 * Google Maps Platform proxy.
 *
 * Holds GOOGLE_MAPS_API_KEY server-side only and forwards Geocoding / Places /
 * Distance Matrix / Timezone requests. The SPA must never see the API key.
 *
 * Deploy secrets (Supabase Edge Function secrets, not VITE_*):
 *   GOOGLE_MAPS_API_KEY=...
 *
 * Request body:
 *   { operation: 'geocode' | 'reverse_geocode' | ..., params: { ... } }
 *
 * Response: Google JSON payload (status + results). Never includes the API key.
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ENDPOINTS: Record<string, string> = {
  geocode: 'https://maps.googleapis.com/maps/api/geocode/json',
  reverse_geocode: 'https://maps.googleapis.com/maps/api/geocode/json',
  place_search: 'https://maps.googleapis.com/maps/api/place/textsearch/json',
  place_details: 'https://maps.googleapis.com/maps/api/place/details/json',
  autocomplete: 'https://maps.googleapis.com/maps/api/place/autocomplete/json',
  distance_matrix: 'https://maps.googleapis.com/maps/api/distancematrix/json',
  timezone: 'https://maps.googleapis.com/maps/api/timezone/json',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
  if (!apiKey) {
    return jsonResponse({
      error: 'Google Maps API key is not configured on the server',
      code: 'GOOGLE_MAPS_SERVER_NOT_CONFIGURED',
    }, 503)
  }

  let payload: { operation?: string; params?: Record<string, string | number> }
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, 400)
  }

  const operation = String(payload.operation ?? '')
  const endpoint = ENDPOINTS[operation]
  if (!endpoint) {
    return jsonResponse({
      error: `Unsupported operation: ${operation}`,
      code: 'UNSUPPORTED_OPERATION',
    }, 400)
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
      return jsonResponse({ error: 'rate_limited', status: 'OVER_QUERY_LIMIT' }, 429)
    }
    // Forward Google JSON (includes its own status field). Never echo the API key.
    return new Response(text, {
      status: response.ok ? 200 : response.status === 403 ? 502 : response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Upstream request failed',
      code: 'GOOGLE_MAPS_UPSTREAM_ERROR',
    }, 502)
  }
})
