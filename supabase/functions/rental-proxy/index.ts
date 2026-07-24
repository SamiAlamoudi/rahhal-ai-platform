/**
 * Rental cars (RapidAPI) proxy — SCAFFOLD ONLY.
 *
 * Disabled by default. Does not change runtime SPA behavior until
 * `RENTAL_PROXY_ENABLED=true` is set on the Edge runtime AND the SPA
 * is pointed at this function via `VITE_RENTAL_PROXY_URL`.
 *
 * Deploy secrets (never VITE_*):
 *   RAPIDAPI_KEY / RENTAL_API_KEY
 *   RENTAL_RAPIDAPI_HOST (optional)
 *   RENTAL_PROXY_ENABLED=true   ← required to serve traffic
 *   EDGE_ALLOWED_ORIGINS=...
 *   SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
 *
 * Request body (when enabled):
 *   { path: string, method?: 'GET'|'POST', query?: Record<string, string|number|boolean>, body?: unknown }
 */

import {
  buildCorsHeaders,
  corsPreflightResponse,
  jsonEdgeResponse,
  requireEdgeInvokeAuth,
} from '../_shared/edgeSecurity.ts'

const DEFAULT_HOST = 'rentalcars-com.p.rapidapi.com'

/** Prevent SSRF — only known rental RapidAPI paths. Expand when wiring live. */
const ALLOWED_PATHS = new Set([
  '/cars/search',
  '/cars/searchLocation',
  '/cars/getVehicleDetails',
])

function isProxyEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (Deno.env.get('RENTAL_PROXY_ENABLED') ?? 'false').trim().toLowerCase(),
  )
}

function readRentalApiKey(): string | null {
  return (
    Deno.env.get('RENTAL_API_KEY')
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

  // Scaffold: refuse traffic unless explicitly enabled — zero runtime impact by default.
  if (!isProxyEnabled()) {
    return jsonEdgeResponse({
      error: 'Rental proxy is disabled (scaffold only)',
      code: 'RENTAL_PROXY_DISABLED',
      hint: 'Set RENTAL_PROXY_ENABLED=true and configure RAPIDAPI_KEY / RENTAL_API_KEY to enable',
    }, 503, cors)
  }

  const apiKey = readRentalApiKey()
  if (!apiKey) {
    return jsonEdgeResponse({
      error: 'Rental/RapidAPI key is not configured on the server',
      code: 'RENTAL_SERVER_NOT_CONFIGURED',
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

  const host = (Deno.env.get('RENTAL_RAPIDAPI_HOST') ?? DEFAULT_HOST).replace(/\/$/, '')
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
      code: 'RENTAL_UPSTREAM_ERROR',
    }, 502, cors)
  }
})
