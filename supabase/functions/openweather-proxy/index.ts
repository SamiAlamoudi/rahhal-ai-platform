/**
 * OpenWeather proxy.
 *
 * Holds OPENWEATHER_API_KEY server-side only and forwards current / forecast /
 * One Call / UVI requests. The SPA must never see the API key.
 *
 * Deploy secrets (Supabase Edge Function secrets, not VITE_*):
 *   OPENWEATHER_API_KEY=...
 *   EDGE_ALLOWED_ORIGINS=...
 *   SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
 *
 * Request body:
 *   { operation: 'current' | 'forecast' | 'onecall' | 'uvi', params: { ... } }
 */

import {
  buildCorsHeaders,
  corsPreflightResponse,
  jsonEdgeResponse,
  requireEdgeInvokeAuth,
} from '../_shared/edgeSecurity.ts'

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
  const cors = buildCorsHeaders(req, { methods: ['POST', 'OPTIONS'] })

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req, { methods: ['POST', 'OPTIONS'] })
  }

  if (req.method !== 'POST') {
    return jsonEdgeResponse({ error: 'Method not allowed' }, 405, cors)
  }

  const authError = requireEdgeInvokeAuth(req, cors)
  if (authError) return authError

  const apiKey = Deno.env.get('OPENWEATHER_API_KEY')
  if (!apiKey) {
    return jsonEdgeResponse({
      error: 'OpenWeather API key is not configured on the server',
      code: 'OPENWEATHER_SERVER_NOT_CONFIGURED',
    }, 503, cors)
  }

  let payload: { operation?: string; params?: Record<string, string | number> }
  try {
    payload = await req.json()
  } catch {
    return jsonEdgeResponse({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, 400, cors)
  }

  const operation = String(payload.operation ?? '')
  const endpoint = endpointFor(operation)
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
  search.set('appid', apiKey)

  try {
    const response = await fetch(`${endpoint}?${search.toString()}`)
    const text = await response.text()
    if (response.status === 429) {
      return jsonEdgeResponse({ error: 'rate_limited', cod: 429 }, 429, cors)
    }
    return new Response(text, {
      status: response.ok ? 200 : response.status === 401 ? 502 : response.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return jsonEdgeResponse({
      error: error instanceof Error ? error.message : 'Upstream request failed',
      code: 'OPENWEATHER_UPSTREAM_ERROR',
    }, 502, cors)
  }
})
