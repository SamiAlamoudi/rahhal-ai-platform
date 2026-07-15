/**
 * Phase AG — REST routes for /trip-planner/plans/*
 * Transport only: auth → validate → TripPlannerService (via plan store) → response.
 */

import { randomUUID } from 'node:crypto'
import { createCorrelationId, setCorrelationId } from '../../../ops/logging/correlation'
import { getLogger } from '../../../ops/logging/structuredLogger'
import {
  assertRequestSize,
  buildCorsPolicy,
  checkDomainRateLimit,
  DEFAULT_MAX_REQUEST_BYTES,
  SECURITY_HEADERS,
} from '../../../ops/security/securityPolicy'
import type { TripPlannerService } from '../tripPlannerService'
import { validateTripPlannerRequest } from '../validation'
import type { TripPlannerAuthResolver } from './auth'
import { getTripPlannerApiMetrics } from './apiMetrics'
import {
  dtoToTripPlannerRequest,
  sanitizeCreateDto,
  toTimelineDto,
  toTripPlanResultDto,
  type CreateTripPlanResponseDto,
  type TripPlanStatusDto,
} from './dto'
import {
  buildErrorBody,
  mapValidationCodeToApi,
  type ApiLocale,
} from './errors'
import {
  isRetryablePlan,
  planProgress,
  TripPlannerPlanStore,
  type StoredApiPlan,
} from './planStore'
import type { TripPlannerAuthUser } from './types'

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/
const CORRELATION_ID_RE = /^[A-Za-z0-9._:-]{8,128}$/

export interface TripPlannerRestContext {
  service: TripPlannerService
  planStore: TripPlannerPlanStore
  authResolver: TripPlannerAuthResolver
  allowedOrigins?: string[]
  maxRequestBytes?: number
  requireAuth?: boolean
}

function corsHeaders(req: Request, allowedOrigins?: string[]): Record<string, string> {
  const policy = buildCorsPolicy({
    allowedOrigins,
    requestOrigin: req.headers.get('Origin'),
  })
  return {
    'Access-Control-Allow-Origin': policy.allowOrigin,
    'Access-Control-Allow-Headers':
      `${policy.allowHeaders}, idempotency-key, prefer, accept-language`,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': policy.maxAge,
  }
}

function securityResponseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': SECURITY_HEADERS['X-Content-Type-Options'],
    'Referrer-Policy': SECURITY_HEADERS['Referrer-Policy'],
  }
}

function json(
  body: unknown,
  status: number,
  cors: Record<string, string>,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      ...securityResponseHeaders(),
      ...extra,
    },
  })
}

function resolveLocale(req: Request, dtoLang?: string | null): ApiLocale {
  if (dtoLang === 'ar' || dtoLang === 'en') return dtoLang
  const accept = req.headers.get('Accept-Language')?.toLowerCase() ?? ''
  if (accept.startsWith('ar')) return 'ar'
  return 'en'
}

function isAdmin(user: TripPlannerAuthUser): boolean {
  return user.role === 'admin'
}

function canAccessPlan(user: TripPlannerAuthUser, plan: StoredApiPlan): boolean {
  return isAdmin(user) || plan.ownerUserId === user.id
}

function rateKey(req: Request, user: TripPlannerAuthUser | null): string {
  return (user?.id ?? req.headers.get('x-forwarded-for') ?? 'anonymous').toString()
}

function statusUrls(planId: string): { statusUrl: string; resultUrl: string } {
  return {
    statusUrl: `/trip-planner/plans/${planId}/status`,
    resultUrl: `/trip-planner/plans/${planId}`,
  }
}

function toStatusDto(plan: StoredApiPlan): TripPlanStatusDto {
  return {
    planId: plan.planId,
    status: plan.status,
    currentStage: plan.currentStage,
    progress: planProgress(plan),
    startedAt: plan.startedAt,
    updatedAt: plan.updatedAt,
    completedAt: plan.completedAt,
    retryable: isRetryablePlan(plan),
    correlationId: plan.correlationId,
  }
}

function toCreateResponse(plan: StoredApiPlan): CreateTripPlanResponseDto {
  const urls = statusUrls(plan.planId)
  const progress = planProgress(plan)
  return {
    planId: plan.planId,
    status: plan.status === 'accepted' ? 'accepted' : plan.status,
    currentStage: plan.currentStage,
    progress,
    correlationId: plan.correlationId,
    ...urls,
    result:
      plan.result != null
        ? toTripPlanResultDto(plan.planId, plan.result, progress)
        : null,
  }
}

function mapCreateHttpStatus(plan: StoredApiPlan): number {
  if (plan.mode === 'async' && (plan.status === 'accepted' || plan.status === 'running' || plan.status === 'queued')) {
    return 202
  }
  if (!plan.result) return 202
  if (plan.result.status === 'cancelled') return 200

  // Failure codes take precedence over partial payloads (e.g. timeout with prior stages).
  if (plan.result.failure?.code === 'timeout' || plan.result.failure?.code === 'pipeline_timeout') {
    return 504
  }
  if (
    plan.result.failure?.code === 'service_unavailable' ||
    plan.result.failure?.code === 'dependency_unavailable'
  ) {
    return 503
  }
  if (
    plan.result.validationErrors.length > 0 ||
    plan.result.failure?.stage === 'Validating'
  ) {
    return 422
  }
  if (plan.result.status === 'failed') return 500
  if (plan.result.status === 'completed' || plan.result.status === 'partial') return 201
  return 201
}

function parsePlansPath(pathname: string): {
  planId: string | null
  action: 'collection' | 'result' | 'status' | 'timeline' | 'cancel' | 'retry' | null
} | null {
  const normalized = pathname.replace(/\/+$/, '')
  const marker = '/trip-planner/plans'
  const idx = normalized.toLowerCase().indexOf(marker)
  if (idx < 0) return null
  const rest = normalized.slice(idx + marker.length)
  if (rest === '' || rest === '/') {
    return { planId: null, action: 'collection' }
  }
  const parts = rest.replace(/^\//, '').split('/')
  const planId = parts[0] ?? null
  if (!planId) return { planId: null, action: 'collection' }
  const sub = (parts[1] ?? '').toLowerCase()
  if (!sub) return { planId, action: 'result' }
  if (sub === 'status') return { planId, action: 'status' }
  if (sub === 'timeline') return { planId, action: 'timeline' }
  if (sub === 'cancel') return { planId, action: 'cancel' }
  if (sub === 'retry') return { planId, action: 'retry' }
  return { planId, action: null }
}

export function isTripPlannerRestPath(pathname: string): boolean {
  return pathname.toLowerCase().includes('/trip-planner/plans')
}

export function createPlanStore(service: TripPlannerService): TripPlannerPlanStore {
  return new TripPlannerPlanStore(service)
}

export async function handleTripPlannerRestRequest(
  req: Request,
  ctx: TripPlannerRestContext,
): Promise<Response> {
  const started = Date.now()
  const cors = corsHeaders(req, ctx.allowedOrigins)
  const metrics = getTripPlannerApiMetrics()
  const rawCorr = req.headers.get('x-correlation-id')?.trim()
  const correlationId =
    rawCorr && CORRELATION_ID_RE.test(rawCorr) ? rawCorr : createCorrelationId()
  setCorrelationId(correlationId)
  const corrHeaders = { 'x-correlation-id': correlationId }
  const logger = getLogger()
  const pathInfo = parsePlansPath(new URL(req.url).pathname)

  const finish = (res: Response, endpoint: string) => {
    metrics.incr('trip_planner_api.request_count', { endpoint })
    metrics.incr('trip_planner_api.response_status', {
      endpoint,
      status: String(res.status),
    })
    metrics.observe('trip_planner_api.endpoint_latency_ms', Date.now() - started, {
      endpoint,
    })
    logger.info('trip_planner_api', endpoint, 'request_completed', {
      endpoint,
      status: res.status,
      durationMs: Date.now() - started,
      correlationId,
    })
    return res
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: { ...cors, ...corrHeaders } })
  }

  if (!pathInfo || pathInfo.action === null) {
    return finish(
      json(
        buildErrorBody('METHOD_NOT_ALLOWED', correlationId, 'en'),
        404,
        cors,
        corrHeaders,
      ),
      'unknown',
    )
  }

  const requireAuth = ctx.requireAuth !== false
  const user = await ctx.authResolver.resolveUser(req.headers.get('Authorization'))
  if (requireAuth && !user) {
    metrics.incr('trip_planner_api.authorization_failures', { reason: 'unauthenticated' })
    return finish(
      json(buildErrorBody('UNAUTHENTICATED', correlationId, 'en', { retryable: false }), 401, cors, corrHeaders),
      pathInfo.action,
    )
  }

  // POST /trip-planner/plans
  if (pathInfo.action === 'collection') {
    if (req.method !== 'POST') {
      return finish(
        json(buildErrorBody('METHOD_NOT_ALLOWED', correlationId, 'en'), 405, cors, corrHeaders),
        'create',
      )
    }

    if (!user) {
      return finish(
        json(buildErrorBody('UNAUTHENTICATED', correlationId, 'en'), 401, cors, corrHeaders),
        'create',
      )
    }

    if (!checkDomainRateLimit('trip_planner_create', `create:${rateKey(req, user)}`)) {
      return finish(
        json(buildErrorBody('RATE_LIMITED', correlationId, 'en', { retryable: true }), 429, cors, corrHeaders),
        'create',
      )
    }

    const contentType = req.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
      return finish(
        json(
          buildErrorBody('INVALID_CONTENT_TYPE', correlationId, 'en', { retryable: false }),
          400,
          cors,
          corrHeaders,
        ),
        'create',
      )
    }

    const raw = await req.text()
    try {
      assertRequestSize(
        new TextEncoder().encode(raw).byteLength,
        ctx.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES,
      )
    } catch {
      return finish(
        json(
          buildErrorBody('REQUEST_TOO_LARGE', correlationId, 'en', { retryable: false }),
          400,
          cors,
          corrHeaders,
        ),
        'create',
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return finish(
        json(buildErrorBody('INVALID_JSON', correlationId, 'en'), 400, cors, corrHeaders),
        'create',
      )
    }

    if (
      parsed &&
      typeof parsed === 'object' &&
      ('payment' in (parsed as object) ||
        'paymentMethod' in (parsed as object) ||
        'cardNumber' in (parsed as object) ||
        'cvv' in (parsed as object))
    ) {
      return finish(
        json(
          buildErrorBody('INVALID_JSON', correlationId, 'en', {
            message: 'Payment details are not accepted on trip planner endpoints.',
            retryable: false,
          }),
          400,
          cors,
          corrHeaders,
        ),
        'create',
      )
    }

    const dto = sanitizeCreateDto(parsed)
    if (!dto) {
      return finish(
        json(buildErrorBody('INVALID_JSON', correlationId, 'en'), 400, cors, corrHeaders),
        'create',
      )
    }

    const locale = resolveLocale(req, dto.preferredLanguage)
    const headerKey = req.headers.get('Idempotency-Key')?.trim()
    if (headerKey && !IDEMPOTENCY_KEY_RE.test(headerKey)) {
      return finish(
        json(
          buildErrorBody('INVALID_IDEMPOTENCY_KEY', correlationId, locale, { retryable: false }),
          400,
          cors,
          corrHeaders,
        ),
        'create',
      )
    }
    const idempotencyKey = headerKey || `auto_${randomUUID()}`

    // Transport + canonical domain validation before execution.
    const domainRequest = dtoToTripPlannerRequest(dto, user.id, idempotencyKey)
    const validationErrors = validateTripPlannerRequest(domainRequest)
    if (validationErrors.length > 0) {
      metrics.incr('trip_planner_api.validation_failures')
      const first = validationErrors[0]!
      const apiCode = mapValidationCodeToApi(first.code)
      return finish(
        json(
          buildErrorBody(apiCode, correlationId, locale, {
            field: first.field,
            retryable: false,
            message: locale === 'ar'
              ? buildErrorBody(apiCode, correlationId, 'ar').error.message
              : first.message,
          }),
          422,
          cors,
          corrHeaders,
        ),
        'create',
      )
    }

    const prefer = req.headers.get('Prefer')?.toLowerCase() ?? ''
    const url = new URL(req.url)
    const asyncMode =
      prefer.includes('respond-async') ||
      url.searchParams.get('async') === '1' ||
      url.searchParams.get('async') === 'true'

    const createStarted = Date.now()
    const outcome = await ctx.planStore.create({
      ownerUserId: user.id,
      dto,
      idempotencyKey,
      correlationId,
      mode: asyncMode ? 'async' : 'sync',
    })

    if (outcome.kind === 'conflict') {
      const code = outcome.code
      return finish(
        json(buildErrorBody(code, correlationId, locale, { retryable: false }), 409, cors, corrHeaders),
        'create',
      )
    }

    metrics.observe(
      'trip_planner_api.plan_creation_latency_ms',
      Date.now() - createStarted,
      { mode: asyncMode ? 'async' : 'sync' },
    )

    const plan = outcome.plan
    // Replay of prior create: same status semantics as original completion.
    let status = mapCreateHttpStatus(plan)
    if (outcome.kind === 'replay') {
      if (plan.active || plan.status === 'accepted' || plan.status === 'running') {
        status = 202
      } else if (plan.result?.status === 'completed' || plan.result?.status === 'partial') {
        status = 201
      } else if (plan.result?.validationErrors.length) {
        status = 422
      }
    }

    // Domain failure after create: map status; include result for partials.
    if (status === 422 && plan.result) {
      return finish(
        json(
          {
            ...buildErrorBody(
              mapValidationCodeToApi(plan.result.validationErrors[0]?.code ?? 'VALIDATION_ERROR'),
              correlationId,
              locale,
              {
                field: plan.result.validationErrors[0]?.field,
                retryable: false,
              },
            ),
            result: toTripPlanResultDto(plan.planId, plan.result, planProgress(plan)),
          },
          422,
          cors,
          corrHeaders,
        ),
        'create',
      )
    }

    if (status === 504) {
      return finish(
        json(
          {
            ...buildErrorBody('TIMEOUT', correlationId, locale, { retryable: true }),
            ...toCreateResponse(plan),
          },
          504,
          cors,
          corrHeaders,
        ),
        'create',
      )
    }

    return finish(json(toCreateResponse(plan), status, cors, corrHeaders), 'create')
  }

  // Plan-scoped routes
  const planId = pathInfo.planId
  if (!planId || !user) {
    return finish(
      json(buildErrorBody('NOT_FOUND', correlationId, 'en'), 404, cors, corrHeaders),
      pathInfo.action,
    )
  }

  const expectedMethod =
    pathInfo.action === 'cancel' || pathInfo.action === 'retry' ? 'POST' : 'GET'
  if (req.method !== expectedMethod) {
    return finish(
      json(buildErrorBody('METHOD_NOT_ALLOWED', correlationId, 'en'), 405, cors, corrHeaders),
      pathInfo.action,
    )
  }

  // Rate-limit polling / mutations before store lookup to prevent abuse.
  if (pathInfo.action === 'status') {
    if (!checkDomainRateLimit('trip_planner_status', `status:${rateKey(req, user)}`)) {
      return finish(
        json(buildErrorBody('RATE_LIMITED', correlationId, 'en', { retryable: true }), 429, cors, corrHeaders),
        'status',
      )
    }
    metrics.incr('trip_planner_api.status_polling')
  } else if (pathInfo.action === 'cancel') {
    if (!checkDomainRateLimit('trip_planner_cancel', `cancel:${rateKey(req, user)}`)) {
      return finish(
        json(buildErrorBody('RATE_LIMITED', correlationId, 'en', { retryable: true }), 429, cors, corrHeaders),
        'cancel',
      )
    }
  } else if (pathInfo.action === 'retry') {
    if (!checkDomainRateLimit('trip_planner_retry', `retry:${rateKey(req, user)}`)) {
      return finish(
        json(buildErrorBody('RATE_LIMITED', correlationId, 'en', { retryable: true }), 429, cors, corrHeaders),
        'retry',
      )
    }
  }

  const plan = ctx.planStore.get(planId)
  if (!plan || !canAccessPlan(user, plan)) {
    // Avoid revealing existence for other users.
    if (plan && !canAccessPlan(user, plan)) {
      metrics.incr('trip_planner_api.authorization_failures', { reason: 'forbidden' })
    }
    return finish(
      json(buildErrorBody('NOT_FOUND', correlationId, 'en'), 404, cors, corrHeaders),
      pathInfo.action,
    )
  }

  if (pathInfo.action === 'result') {
    if (!plan.result) {
      // Still processing — return status-shaped payload with 202.
      return finish(json(toCreateResponse(plan), 202, cors, corrHeaders), 'result')
    }
    return finish(
      json(toTripPlanResultDto(plan.planId, plan.result, planProgress(plan)), 200, cors, corrHeaders),
      'result',
    )
  }

  if (pathInfo.action === 'status') {
    return finish(json(toStatusDto(plan), 200, cors, corrHeaders), 'status')
  }

  if (pathInfo.action === 'timeline') {
    const events = plan.result?.pipelineTimeline ?? plan.events
    return finish(json(toTimelineDto(plan.planId, events), 200, cors, corrHeaders), 'timeline')
  }

  if (pathInfo.action === 'cancel') {
    const cancelled = ctx.planStore.cancel(planId) ?? plan
    return finish(json(toStatusDto(cancelled), 200, cors, corrHeaders), 'cancel')
  }

  if (pathInfo.action === 'retry') {
    const outcome = await ctx.planStore.retry({ planId, correlationId })
    if (outcome.kind === 'not_found') {
      return finish(
        json(buildErrorBody('NOT_FOUND', correlationId, 'en'), 404, cors, corrHeaders),
        'retry',
      )
    }
    if (outcome.kind === 'conflict') {
      return finish(
        json(
          buildErrorBody(
            outcome.code === 'NOT_RETRYABLE' ? 'INVALID_STATE' : 'INVALID_STATE',
            correlationId,
            'en',
            { retryable: false },
          ),
          409,
          cors,
          corrHeaders,
        ),
        'retry',
      )
    }
    return finish(json(toCreateResponse(outcome.plan), 200, cors, corrHeaders), 'retry')
  }

  return finish(
    json(buildErrorBody('METHOD_NOT_ALLOWED', correlationId, 'en'), 405, cors, corrHeaders),
    'unknown',
  )
}
