/**
 * Phase AG — thin Trip Planner HTTP handler.
 *
 * Flow: HTTP → auth → transport validation → TripPlannerService → HTTP
 * Does not create a second orchestration layer.
 */

import { createCorrelationId, setCorrelationId } from '../../../ops/logging/correlation'
import {
  assertRequestSize,
  buildCorsPolicy,
  checkDomainRateLimit,
  DEFAULT_MAX_REQUEST_BYTES,
} from '../../../ops/security/securityPolicy'
import {
  createTripPlannerService,
  type TripPlannerService,
  type TripPlannerServiceOptions,
} from '../tripPlannerService'
import type { TripPlannerRequest, TripPlannerResult } from '../models'
import {
  assertUserOwnsRequest,
  createDevTokenAuthResolver,
  type TripPlannerAuthResolver,
} from './auth'
import type {
  TripPlannerApiErrorBody,
  TripPlannerApiRequestBody,
  TripPlannerApiSuccessBody,
  TripPlannerAuthUser,
} from './types'

export interface TripPlannerHttpHandlerOptions {
  service?: TripPlannerService
  serviceOptions?: TripPlannerServiceOptions
  authResolver?: TripPlannerAuthResolver
  allowedOrigins?: string[]
  maxRequestBytes?: number
  rateLimitKey?: (req: Request, user: TripPlannerAuthUser | null) => string
  requireAuth?: boolean
}

function jsonResponse(
  body: TripPlannerApiSuccessBody | TripPlannerApiErrorBody,
  status: number,
  cors: Record<string, string>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  })
}

function corsHeaderRecord(req: Request, allowedOrigins?: string[]): Record<string, string> {
  const policy = buildCorsPolicy({
    allowedOrigins,
    requestOrigin: req.headers.get('Origin'),
  })
  return {
    'Access-Control-Allow-Origin': policy.allowOrigin,
    'Access-Control-Allow-Headers': policy.allowHeaders,
    'Access-Control-Allow-Methods': policy.allowMethods,
    'Access-Control-Max-Age': policy.maxAge,
  }
}

function parseAction(
  req: Request,
  body: TripPlannerApiRequestBody | null,
): 'plan' | 'get_result' | 'health' | null {
  const url = new URL(req.url)
  const path = url.pathname.toLowerCase()
  if (path.endsWith('/health') || url.searchParams.get('action') === 'health') {
    return 'health'
  }
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
  if (req.method === 'POST') {
    const action = body && 'action' in body ? body.action : undefined
    if (action === 'get_result') return 'get_result'
    if (action === 'health') return 'health'
    if (action === 'plan' || action == null || action === '') return 'plan'
    if (path.endsWith('/result')) return 'get_result'
    if (path.endsWith('/plan')) return 'plan'
  }
  return null
}

function isTripPlannerRequest(value: unknown): value is TripPlannerRequest {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.requestId === 'string' &&
    typeof v.userId === 'string' &&
    Array.isArray(v.destinations) &&
    typeof v.idempotencyKey === 'string'
  )
}

/**
 * Canonical Trip Planner API entrypoint (Fetch API compatible).
 */
export async function handleTripPlannerHttpRequest(
  req: Request,
  options: TripPlannerHttpHandlerOptions = {},
): Promise<Response> {
  const cors = corsHeaderRecord(req, options.allowedOrigins)
  const correlationId =
    req.headers.get('x-correlation-id')?.trim() || createCorrelationId()
  setCorrelationId(correlationId)
  const corrHeaders = { 'x-correlation-id': correlationId }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: { ...cors, ...corrHeaders } })
  }

  const requireAuth = options.requireAuth !== false
  const authResolver = options.authResolver ?? createDevTokenAuthResolver()
  const service =
    options.service ?? createTripPlannerService(options.serviceOptions)

  let body: TripPlannerApiRequestBody | null = null
  if (req.method === 'POST') {
    const raw = await req.text()
    try {
      assertRequestSize(
        new TextEncoder().encode(raw).byteLength,
        options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES,
      )
    } catch {
      return jsonResponse(
        {
          error: 'Request body is too large.',
          code: 'request_too_large',
          correlationId,
          retryable: false,
        },
        413,
        cors,
        corrHeaders,
      )
    }
    if (raw.trim()) {
      try {
        body = JSON.parse(raw) as TripPlannerApiRequestBody
      } catch {
        return jsonResponse(
          {
            error: 'Request body must be valid JSON.',
            code: 'invalid_body',
            correlationId,
            retryable: false,
          },
          400,
          cors,
          corrHeaders,
        )
      }
    }
  }

  const action = parseAction(req, body)
  if (!action) {
    return jsonResponse(
      {
        error: 'Unsupported method or action.',
        code: 'method_not_allowed',
        correlationId,
        retryable: false,
      },
      405,
      cors,
      corrHeaders,
    )
  }

  if (action === 'health') {
    return jsonResponse(
      {
        status: 'ok',
        service: 'trip-planner',
        version: 1,
        paymentProvider: 'mock',
        liveProvidersEnabled: false,
        bookingEnabled: false,
        ts: new Date().toISOString(),
      },
      200,
      cors,
      corrHeaders,
    )
  }

  const user = await authResolver.resolveUser(req.headers.get('Authorization'))
  if (requireAuth && !user) {
    return jsonResponse(
      {
        error: 'Authentication required.',
        code: 'auth_error',
        correlationId,
        retryable: false,
      },
      401,
      cors,
      corrHeaders,
    )
  }

  const rateKey = (
    options.rateLimitKey?.(req, user) ??
    user?.id ??
    req.headers.get('x-forwarded-for') ??
    'anonymous'
  ).toString()
  if (!checkDomainRateLimit('search', `trip_planner:${rateKey}`)) {
    return jsonResponse(
      {
        error: 'Too many trip planning requests. Please try again later.',
        code: 'rate_limited',
        correlationId,
        retryable: true,
      },
      429,
      cors,
      corrHeaders,
    )
  }

  if (action === 'plan') {
    if (req.method !== 'POST') {
      return jsonResponse(
        { error: 'Plan requires POST.', code: 'method_not_allowed', correlationId },
        405,
        cors,
        corrHeaders,
      )
    }

    const planBody = body as { request?: unknown; action?: string } | null
    const nested =
      planBody &&
      typeof planBody === 'object' &&
      'request' in planBody &&
      planBody.request != null
    const request = nested ? planBody!.request : body
    if (!isTripPlannerRequest(request)) {
      return jsonResponse(
        {
          error:
            'Body must be a TripPlannerRequest or { action: "plan", request: TripPlannerRequest }.',
          code: 'invalid_body',
          correlationId,
          retryable: false,
        },
        400,
        cors,
        corrHeaders,
      )
    }

    if (user) {
      const ownership = assertUserOwnsRequest(user, request.userId)
      if (!ownership.ok) {
        return jsonResponse(
          {
            error: ownership.error,
            code: ownership.code,
            correlationId,
            retryable: false,
          },
          403,
          cors,
          corrHeaders,
        )
      }
    }

    // Safe transport defaults — never enable live booking/payment via API.
    const safeRequest: TripPlannerRequest = {
      ...request,
      includeBookingPreview: request.includeBookingPreview === true,
    }

    const result = await service.plan(safeRequest, { signal: req.signal })
    // Domain outcomes stay in TripPlannerResult; transport success is HTTP 200.
    return jsonResponse(
      { ok: true, action: 'plan', result },
      200,
      cors,
      corrHeaders,
    )
  }

  // get_result
  const url = new URL(req.url)
  const getBody = body as { idempotencyKey?: string; requestId?: string } | null
  const idempotencyKey =
    getBody?.idempotencyKey ?? url.searchParams.get('idempotencyKey')
  const requestId = getBody?.requestId ?? url.searchParams.get('requestId')

  if (!idempotencyKey && !requestId) {
    return jsonResponse(
      {
        error: 'idempotencyKey or requestId is required.',
        code: 'invalid_body',
        correlationId,
        retryable: false,
      },
      400,
      cors,
      corrHeaders,
    )
  }

  let result: TripPlannerResult | null = null
  if (idempotencyKey) {
    result = service.getStoredResult(idempotencyKey)
  }
  if (!result && requestId) {
    result = service.getResultByRequestId(requestId)
  }

  if (!result) {
    return jsonResponse(
      {
        error: 'Trip planning result not found.',
        code: 'not_found',
        correlationId,
        retryable: false,
      },
      404,
      cors,
      corrHeaders,
    )
  }

  if (user && result.userId !== user.id) {
    return jsonResponse(
      {
        error: 'Trip planning result not found.',
        code: 'not_found',
        correlationId,
        retryable: false,
      },
      404,
      cors,
      corrHeaders,
    )
  }

  return jsonResponse(
    { ok: true, action: 'get_result', result },
    200,
    cors,
    corrHeaders,
  )
}

export function createTripPlannerHttpHandler(
  options: TripPlannerHttpHandlerOptions = {},
): (req: Request) => Promise<Response> {
  const service =
    options.service ?? createTripPlannerService(options.serviceOptions)
  return (req: Request) => handleTripPlannerHttpRequest(req, { ...options, service })
}
