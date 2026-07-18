/**
 * Phase AG — Trip Planner API Edge Function namespace.
 *
 * Transport-only gateway following existing Edge patterns:
 *   HTTP → auth (Supabase JWT) → transport validation → planning host
 *
 * Supports legacy actions (plan / get_result / health) and REST paths:
 *   /trip-planner/plans[...]
 *
 * Safe defaults:
 * - VITE_PAYMENT_PROVIDER / PAYMENT_PROVIDER treated as mock
 * - Live providers OFF
 * - No real booking / payment / ticketing
 *
 * Does not create a second orchestration layer — does not score, rank,
 * or build itineraries itself.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-correlation-id, idempotency-key, prefer, accept-language',
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

async function resolveUser(req: Request): Promise<{ id: string; email: string | null; role: string | null } | null> {
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
  const role =
    (data.user.app_metadata as { role?: string } | undefined)?.role === 'admin'
      ? 'admin'
      : null
  return { id: data.user.id, email: data.user.email ?? null, role }
}

function isRestPlansPath(pathname: string): boolean {
  return pathname.toLowerCase().includes('/trip-planner/plans')
}

function parsePathAction(req: Request, body: Record<string, unknown> | null): string {
  const url = new URL(req.url)
  const path = url.pathname.toLowerCase()
  if (isRestPlansPath(path)) return 'rest'
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
  let rawBody: string | null = null
  if (req.method === 'POST') {
    try {
      rawBody = await req.text()
      body = rawBody.trim() ? (JSON.parse(rawBody) as Record<string, unknown>) : null
    } catch {
      return jsonResponse(
        {
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON.',
            retryable: false,
            correlationId: corr,
          },
        },
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
      {
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Unsupported method or action.',
          retryable: false,
          correlationId: corr,
        },
      },
      405,
      corrHeaders,
    )
  }

  const user = await resolveUser(req)
  if (!user) {
    return jsonResponse(
      {
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.',
          retryable: false,
          correlationId: corr,
        },
      },
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
    const idem = req.headers.get('Idempotency-Key')
    if (idem) forwardHeaders.set('Idempotency-Key', idem)
    const prefer = req.headers.get('Prefer')
    if (prefer) forwardHeaders.set('Prefer', prefer)
    const acceptLanguage = req.headers.get('Accept-Language')
    if (acceptLanguage) forwardHeaders.set('Accept-Language', acceptLanguage)

    const url = new URL(req.url)
    let target: string
    if (action === 'rest') {
      // Preserve REST path + query for the shared handler host.
      const path = url.pathname
      const restIdx = path.toLowerCase().indexOf('/trip-planner/plans')
      const restPath = restIdx >= 0 ? path.slice(restIdx) : path
      target = `${handlerUrl}${restPath}${url.search}`
    } else {
      target =
        action === 'get_result'
          ? `${handlerUrl}/result${url.search}`
          : `${handlerUrl}/plan`
    }

    const forward = await fetch(target, {
      method: req.method,
      headers: forwardHeaders,
      body:
        req.method === 'GET' || req.method === 'OPTIONS'
          ? undefined
          : action === 'rest'
            ? rawBody
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

  // Without a handler host, Edge remains a secure namespace stub.
  if (action === 'rest') {
    return jsonResponse(
      {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message:
            'Trip planner Edge gateway authenticated the request. Set TRIP_PLANNER_HANDLER_URL to the shared HTTP handler host, or use the in-process API client.',
          retryable: true,
          correlationId: corr,
        },
      },
      503,
      corrHeaders,
    )
  }

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
