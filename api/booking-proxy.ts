/**
 * Vercel Edge — Booking.com RapidAPI proxy.
 * Mirrors supabase/functions/booking-proxy. Holds RAPIDAPI_KEY server-side.
 */

import {
  buildCorsHeaders,
  corsPreflightResponse,
  jsonEdgeResponse,
  requireEdgeInvokeAuth,
} from './_lib/edgeSecurity.js'

export const config = {
  runtime: 'edge',
}

const DEFAULT_HOST = 'booking-com15.p.rapidapi.com'

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
    process.env.BOOKING_API_KEY
    ?? process.env.RAPIDAPI_KEY
    ?? process.env.BOOKING_RAPIDAPI_KEY
  )?.trim() || null
}

export default async function handler(req: Request): Promise<Response> {
  const cors = buildCorsHeaders(req, { methods: ['POST', 'OPTIONS'] })

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req, { methods: ['POST', 'OPTIONS'] })
  }
  if (req.method !== 'POST') {
    return jsonEdgeResponse({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405, cors)
  }

  const authError = requireEdgeInvokeAuth(req, cors, process.env, {
    allowMissingWhenNoOrigin: false,
  })
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
    payload = await req.json() as typeof payload
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

  const host = (process.env.BOOKING_RAPIDAPI_HOST ?? DEFAULT_HOST).replace(/\/$/, '')
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
}
