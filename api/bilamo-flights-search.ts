/**
 * Vercel Edge Function — Bilamo flight search.
 *
 * POST /api/bilamo-flights-search
 * Server-side Amadeus when credentials exist; deterministic demo otherwise.
 * Secrets never leave the server. Responses are normalized offers only.
 */

import { readAmadeusCredentials } from './_lib/amadeusEnv.js'
import {
  parseBilamoFlightSearchBody,
  runBilamoFlightSearch,
} from './_lib/bilamoFlightSearch.js'
import { buildCorsHeaders } from './_lib/edgeGuard.js'

export const config = {
  runtime: 'edge',
}

function json(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function clientKey(req: Request): string {
  const auth = req.headers.get('authorization')
  if (auth && auth.length > 20) return `auth:${auth.slice(-24)}`
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return `ip:${fwd.split(',')[0]!.trim()}`
  return 'anon'
}

export default async function handler(req: Request): Promise<Response> {
  const { headers: corsHeaders } = buildCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204, headers: corsHeaders })
  }

  if (req.method === 'GET') {
    const creds = readAmadeusCredentials(process.env)
    return json({
      ok: true,
      provider: creds.hasCredentials ? 'amadeus' : 'demo',
      detail: creds.hasCredentials
        ? 'Amadeus credentials configured'
        : 'Demo mode — Amadeus credentials not configured',
    }, 200, corsHeaders)
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed', offers: [] }, 405, corsHeaders)
  }

  let raw: Record<string, unknown> = {}
  try {
    raw = await req.json() as Record<string, unknown>
  } catch {
    return json({ ok: false, error: 'invalid_json', offers: [] }, 400, corsHeaders)
  }

  const body = parseBilamoFlightSearchBody(raw)
  if (!body) {
    return json({ ok: false, error: 'invalid_search_request', offers: [] }, 400, corsHeaders)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const result = await runBilamoFlightSearch({
      body,
      env: process.env as Record<string, string | undefined>,
      signal: controller.signal,
      clientKey: clientKey(req),
      fallbackToDemo: true,
    })
    return json(result, 200, corsHeaders)
  } finally {
    clearTimeout(timer)
  }
}
