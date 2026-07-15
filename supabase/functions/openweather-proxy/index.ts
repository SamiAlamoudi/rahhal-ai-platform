/**
 * OpenWeather proxy.
 *
 * Holds OPENWEATHER_API_KEY server-side only and forwards current / forecast /
 * One Call / UVI requests. The SPA must never see the API key.
 *
 * Deploy secrets (Supabase Edge Function secrets, not VITE_*):
 *   OPENWEATHER_API_KEY=...
 *
 * Request body:
 *   { operation: 'current' | 'forecast' | 'onecall' | 'uvi', params: { ... } }
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function endpointFor(operation: string): string | null {
  switch (operation) {
    case 'current':
      return 'https://api.openweathermap.org/data/2.5/weather'
    case 'forecast':
      return 'https://api.openweathermap.org/data/2.5/forecast'
    case 'uvi':
      return 'https://api.openweathermap.org/data/2.5/uvi'
    case 'onecall':
      return 'https://api.openweathermap.org/data/3.0/onecall'
    default:
      return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const apiKey = Deno.env.get('OPENWEATHER_API_KEY')
  if (!apiKey) {
    return jsonResponse({
      error: 'OpenWeather API key is not configured on the server',
      code: 'OPENWEATHER_SERVER_NOT_CONFIGURED',
    }, 503)
  }

  let payload: { operation?: string; params?: Record<string, string | number> }
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, 400)
  }

  const operation = String(payload.operation ?? '')
  const endpoint = endpointFor(operation)
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
  search.set('appid', apiKey)

  try {
    const response = await fetch(`${endpoint}?${search.toString()}`)
    const text = await response.text()
    if (response.status === 429) {
      return jsonResponse({ error: 'rate_limited', cod: 429 }, 429)
    }
    return new Response(text, {
      status: response.ok ? 200 : response.status === 401 ? 502 : response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Upstream request failed',
      code: 'OPENWEATHER_UPSTREAM_ERROR',
    }, 502)
  }
})
