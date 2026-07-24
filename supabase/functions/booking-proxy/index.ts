/**
 * Booking.com (RapidAPI) proxy.
 *
 * Holds RAPIDAPI_KEY / BOOKING_API_KEY server-side only. The SPA must never
 * see the secret — it calls this function with the Supabase anon key.
 *
 * Deploy secrets:
 *   RAPIDAPI_KEY=...   (or BOOKING_API_KEY / BOOKING_RAPIDAPI_KEY)
 *   BOOKING_RAPIDAPI_HOST=booking-com15.p.rapidapi.com  (optional)
 *   EDGE_ALLOWED_ORIGINS=...
 *   SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
 *
 * Request body:
 *   {
 *     path: '/hotels/searchDestination' | '/hotels/searchHotels' | ...,
 *     method?: 'GET' | 'POST',
 *     query?: Record<string, string | number | boolean>,
 *     body?: unknown   // for POST
 *   }
 */

import {
  buildCorsHeaders,
  corsPreflightResponse,
  jsonEdgeResponse,
  requireEdgeInvokeAuth,
} from '../_shared/edgeSecurity.ts'

const DEFAULT_HOST = 'booking-com15.p.rapidapi.com'

/** Prevent SSRF — only Booking.com RapidAPI hotel paths. */
const ALLOWED_PATHS = new Set([
  '/hotels/searchDestination',
  '/hotels/search',
  '/hotels/searchHotels',
  '/hotels/getHotelDetails',
  '/hotels/getRoomList',
  '/hotels/getHotelPhotos',
  '/hotels/getHotelFacilities',
  '/hotels/getDescriptionAndInfo',
])

function readRapidApiKey(): string | null {
  return (
    Deno.env.get('BOOKING_API_KEY')
    ?? Deno.env.get('RAPIDAPI_KEY')
    ?? Deno.env.get('BOOKING_RAPIDAPI_KEY')
  )?.trim() || null
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req, { methods: ['POST', 'OPTIONS'] })

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req, { methods: ['POST', 'OPTIONS'] })
  }

  if (req.method !== 'POST') {
    return jsonEdgeResponse({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405, cors)
  }

  const authError = requireEdgeInvokeAuth(req, cors)
  if (authError) return authError

  const apiKey = readRapidApiKey()
  if (!apiKey) {
    return jsonEdgeResponse({
      error: 'Booking/RapidAPI key is not configured on the server',
      code: 'BOOKING_SERVER_NOT_CONFIGURED',
    }, 503, cors)
  }

  let payload: {
    path?: string
    method?: string
    query?: Record<string, string | number | boolean>
    body?: unknown
  }
  try {
    payload = await req.json()
  } catch {
    return jsonEdgeResponse({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, 400, cors)
  }

  const rawPath = String(payload.path ?? '').trim()
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  if (!ALLOWED_PATHS.has(path)) {
    return jsonEdgeResponse({
      error: `Unsupported path: ${path}`,
      code: 'UNSUPPORTED_PATH',
    }, 400, cors)
  }

  const method = (payload.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'POST') {
    return jsonEdgeResponse({ error: 'Only GET/POST supported', code: 'METHOD_NOT_ALLOWED' }, 405, cors)
  }

  const host = (Deno.env.get('BOOKING_RAPIDAPI_HOST') ?? DEFAULT_HOST).replace(/\/$/, '')
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(payload.query ?? {})) {
    if (value === undefined || value === null) continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  const upstreamUrl = `https://${host}/api/v1${path}${qs ? `?${qs}` : ''}`

  try {
    const response = await fetch(upstreamUrl, {
      method,
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': host,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: method === 'POST' ? JSON.stringify(payload.body ?? {}) : undefined,
    })
    const text = await response.text()
    return new Response(text, {
      status: response.ok ? 200 : response.status === 401 || response.status === 403 ? 502 : response.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return jsonEdgeResponse({
      error: error instanceof Error ? error.message : 'Upstream request failed',
      code: 'BOOKING_UPSTREAM_ERROR',
    }, 502, cors)
  }
})
