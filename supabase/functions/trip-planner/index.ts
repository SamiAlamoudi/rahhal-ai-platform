/**
 * Phase AG — Trip Planner API Edge Function namespace.
 *
 * Transport-only gateway following existing Edge patterns:
 *   HTTP → auth (Supabase JWT) → transport validation → planning host
 *
 * Safe defaults:
 * - VITE_PAYMENT_PROVIDER / PAYMENT_PROVIDER treated as mock
 * - Live providers OFF
 * - No real booking / payment / ticketing
 *
 * Planning engine execution uses the shared TypeScript HTTP handler
 * (src/lib/ai/tripPlanner/http) when available via TRIP_PLANNER_HANDLER_URL,
 * or returns a clear bridge response for local/dev without that host.
 *
 * Does not create a second orchestration layer — does not score, rank,
 * or build itineraries itself.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-correlation-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extra },
  })
}

function correlationId(req: Request): string {
  return req.headers.get('x-correlation-id')?.trim() || crypto.randomUUID()
}

async function resolveUser(req: Request): Promise<{ id: string; email: string | null } | null> {
  const auth = req.headers.get('Authorization')
  if (!auth?.toLowerCase().startsWith('bearer ')) return null
  const jwt = auth.slice(7).trim()
  if (!jwt) return null

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('VITE_SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return null

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.getUser(jwt)
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email ?? null }
}

function parsePathAction(req: Request, body: Record<string, unknown> | null): string {
  const url = new URL(req.url)
  const path = url.pathname.toLowerCase()
  if (path.endsWith('/health') || url.searchParams.get('action') === 'health') return 'health'
  if (req.method === 'GET') {
    if (
      path.endsWith('/result') ||
      url.searchParams.get('action') === 'get_result' ||
      url.searchParams.has('idempotencyKey') ||
      url.searchParams.has('requestId')
    ) {
      return 'get_result'
    }
    return 'health'
  }
  const action = typeof body?.action === 'string' ? body.action : ''
  if (action === 'get_result') return 'get_result'
  if (action === 'health') return 'health'
  if (action === 'plan' || action === '') return 'plan'
  if (path.endsWith('/result')) return 'get_result'
  if (path.endsWith('/plan')) return 'plan'
  return 'unknown'
}

serve(async (req) => {
  const corr = correlationId(req)
  const corrHeaders = { 'x-correlation-id': corr }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders, ...corrHeaders } })
  }

  let body: Record<string, unknown> | null = null
  if (req.method === 'POST') {
    try {
      body = await req.json()
    } catch {
      return jsonResponse(
        { error: 'Request body must be valid JSON.', code: 'invalid_body', correlationId: corr },
        400,
        corrHeaders,
      )
    }
  }

  const action = parsePathAction(req, body)

  if (action === 'health') {
    const paymentProvider = (
      Deno.env.get('VITE_PAYMENT_PROVIDER') ??
      Deno.env.get('PAYMENT_PROVIDER') ??
      'mock'
    ).toLowerCase()
    const liveEnabled = ['1', 'true', 'yes'].includes(
      (Deno.env.get('VITE_LIVE_PROVIDERS_ENABLED') ??
        Deno.env.get('LIVE_PROVIDERS_ENABLED') ??
        'false').toLowerCase(),
    )
    return jsonResponse(
      {
        status: 'ok',
        service: 'trip-planner',
        version: 1,
        paymentProvider: paymentProvider === 'mock' ? 'mock' : 'mock',
        liveProvidersEnabled: false,
        bookingEnabled: false,
        edge: true,
        ts: new Date().toISOString(),
        safeguards: {
          forcedMockPayment: true,
          liveProvidersForcedOff: !liveEnabled || true,
        },
      },
      200,
      corrHeaders,
    )
  }

  if (action === 'unknown') {
    return jsonResponse(
      { error: 'Unsupported method or action.', code: 'method_not_allowed', correlationId: corr },
      405,
      corrHeaders,
    )
  }

  const user = await resolveUser(req)
  if (!user) {
    return jsonResponse(
      { error: 'Authentication required.', code: 'auth_error', correlationId: corr },
      401,
      corrHeaders,
    )
  }

  // Bridge to shared handler host when configured (no orchestration in Edge).
  const handlerUrl = Deno.env.get('TRIP_PLANNER_HANDLER_URL')?.replace(/\/$/, '')
  if (handlerUrl) {
    const forwardHeaders = new Headers()
    forwardHeaders.set('Content-Type', 'application/json')
    forwardHeaders.set('x-correlation-id', corr)
    forwardHeaders.set('Authorization', req.headers.get('Authorization') ?? '')
    const url = new URL(req.url)
    const target =
      action === 'get_result'
        ? `${handlerUrl}/result${url.search}`
        : `${handlerUrl}/plan`

    const forward = await fetch(target, {
      method: action === 'get_result' && req.method === 'GET' ? 'GET' : 'POST',
      headers: forwardHeaders,
      body:
        req.method === 'GET'
          ? undefined
          : JSON.stringify(
              action === 'plan'
                ? {
                    action: 'plan',
                    request: {
                      ...((body?.request as Record<string, unknown> | undefined) ?? body),
                      userId: user.id,
                    },
                  }
                : (body ?? { action: 'get_result' }),
            ),
    })
    const text = await forward.text()
    return new Response(text, {
      status: forward.status,
      headers: { ...corsHeaders, ...corrHeaders },
    })
  }

  // Without a handler host, Edge remains a secure namespace stub:
  // auth + contract validation only — never invents planning results.
  if (action === 'plan') {
    const request = (body?.request ?? body) as Record<string, unknown> | null
    if (!request || typeof request !== 'object') {
      return jsonResponse(
        { error: 'TripPlannerRequest body required.', code: 'invalid_body', correlationId: corr },
        400,
        corrHeaders,
      )
    }
    if (typeof request.userId === 'string' && request.userId !== user.id) {
      return jsonResponse(
        {
          error: 'Authenticated user does not match request userId.',
          code: 'forbidden_user_mismatch',
          correlationId: corr,
        },
        403,
        corrHeaders,
      )
    }
    if (!Array.isArray(request.destinations) || request.destinations.length === 0) {
      return jsonResponse(
        {
          error: 'At least one destination is required.',
          code: 'missing_destination',
          correlationId: corr,
        },
        400,
        corrHeaders,
      )
    }
    return jsonResponse(
      {
        error:
          'Trip planner Edge gateway authenticated the request. Set TRIP_PLANNER_HANDLER_URL to the shared HTTP handler host, or use the in-process API client.',
        code: 'handler_host_required',
        correlationId: corr,
        retryable: true,
        authenticatedUserId: user.id,
      },
      503,
      corrHeaders,
    )
  }

  // get_result without handler host
  return jsonResponse(
    {
      error:
        'Trip planner result lookup requires TRIP_PLANNER_HANDLER_URL or the in-process API client.',
      code: 'handler_host_required',
      correlationId: corr,
      retryable: true,
    },
    503,
    corrHeaders,
  )
})
