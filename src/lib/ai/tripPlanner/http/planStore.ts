/**
 * Phase AG — API-facing plan execution store.
 * Thin wrapper over TripPlannerService (no second orchestration).
 */

import { createHash, randomUUID } from 'node:crypto'
import type { TripPlannerService } from '../tripPlannerService'
import type {
  TripPlannerPipelineEvent,
  TripPlannerRequest,
  TripPlannerResult,
  TripPlannerStage,
} from '../models'
import type { CreateTripPlanRequestDto, TripPlanApiStatus } from './dto'
import { dtoToTripPlannerRequest } from './dto'
import { progressFromTimeline, progressForStage } from './progress'
import { getTripPlannerApiMetrics } from './apiMetrics'

export type PlanExecutionMode = 'sync' | 'async'

export interface StoredApiPlan {
  planId: string
  ownerUserId: string
  requestDto: CreateTripPlanRequestDto
  request: TripPlannerRequest
  requestHash: string
  idempotencyKey: string
  correlationId: string
  status: TripPlanApiStatus
  currentStage: TripPlannerStage
  result: TripPlannerResult | null
  events: TripPlannerPipelineEvent[]
  startedAt: string
  updatedAt: string
  completedAt: string | null
  abortController: AbortController | null
  mode: PlanExecutionMode
  includeBookingPreview: boolean
  active: boolean
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize((value as Record<string, unknown>)[key])
        return acc
      }, {})
  }
  return value
}

export function hashTripPlanRequest(dto: CreateTripPlanRequestDto, userId: string): string {
  // Exclude volatile / ownership fields from hash identity.
  const { userId: _u, idempotencyKey: _i, requestId: _r, ...rest } = dto
  void _u
  void _i
  void _r
  const payload = JSON.stringify(canonicalize({ ...rest, userId }))
  return createHash('sha256').update(payload).digest('hex')
}

export function planProgress(plan: StoredApiPlan): number {
  if (plan.result) {
    const stages = plan.result.pipelineTimeline.map((e) => e.stage)
    if (stages.length === 0) {
      return progressForStage(plan.result.stage, {
        includeBookingPreview: plan.includeBookingPreview,
      })
    }
    const fromTimeline = progressFromTimeline(stages, plan.includeBookingPreview)
    if (plan.result.status === 'completed') return 100
    if (plan.result.status === 'failed' || plan.result.status === 'cancelled') {
      return fromTimeline
    }
    if (plan.result.status === 'partial') {
      return Math.max(
        fromTimeline,
        progressForStage(plan.result.stage, {
          includeBookingPreview: plan.includeBookingPreview,
          lastCompletedProgress: fromTimeline,
        }),
      )
    }
    return fromTimeline
  }
  return progressForStage(plan.currentStage, {
    includeBookingPreview: plan.includeBookingPreview,
  })
}

export function isRetryablePlan(plan: StoredApiPlan): boolean {
  if (plan.status === 'completed' || plan.status === 'cancelled') return false
  if (plan.status === 'queued' || plan.status === 'running' || plan.status === 'accepted') {
    return false
  }
  return plan.result?.failure?.retryable === true
}

export class TripPlannerPlanStore {
  private readonly byId = new Map<string, StoredApiPlan>()
  private readonly byIdempotency = new Map<string, string>()

  constructor(private readonly service: TripPlannerService) {}

  get(planId: string): StoredApiPlan | undefined {
    return this.byId.get(planId)
  }

  clear(): void {
    this.byId.clear()
    this.byIdempotency.clear()
  }

  private activeCount(): number {
    return [...this.byId.values()].filter((p) => p.active).length
  }

  private touchActiveGauge(): void {
    getTripPlannerApiMetrics().setGauge(
      'trip_planner_api.active_executions',
      this.activeCount(),
    )
  }

  async create(input: {
    ownerUserId: string
    dto: CreateTripPlanRequestDto
    idempotencyKey: string
    correlationId: string
    mode: PlanExecutionMode
  }): Promise<
    | { kind: 'created'; plan: StoredApiPlan }
    | { kind: 'replay'; plan: StoredApiPlan }
    | { kind: 'conflict'; code: 'IDEMPOTENCY_CONFLICT' | 'DUPLICATE_ACTIVE' }
  > {
    const requestHash = hashTripPlanRequest(input.dto, input.ownerUserId)
    const mapKey = `${input.ownerUserId}::${input.idempotencyKey}`
    const existingId = this.byIdempotency.get(mapKey)
    if (existingId) {
      const existing = this.byId.get(existingId)
      if (!existing) {
        this.byIdempotency.delete(mapKey)
      } else if (existing.requestHash !== requestHash) {
        getTripPlannerApiMetrics().incr('trip_planner_api.idempotency_conflicts')
        return { kind: 'conflict', code: 'IDEMPOTENCY_CONFLICT' }
      } else {
        getTripPlannerApiMetrics().incr('trip_planner_api.idempotency_hits')
        return { kind: 'replay', plan: existing }
      }
    }

    for (const plan of this.byId.values()) {
      if (
        plan.ownerUserId === input.ownerUserId &&
        plan.requestHash === requestHash &&
        plan.active
      ) {
        return { kind: 'conflict', code: 'DUPLICATE_ACTIVE' }
      }
    }

    const request = dtoToTripPlannerRequest(
      input.dto,
      input.ownerUserId,
      input.idempotencyKey,
    )
    const abortController = new AbortController()
    const planId = randomUUID()
    const startedAt = new Date().toISOString()
    const plan: StoredApiPlan = {
      planId,
      ownerUserId: input.ownerUserId,
      requestDto: structuredClone(input.dto),
      request,
      requestHash,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      status: input.mode === 'async' ? 'accepted' : 'running',
      currentStage: 'Received',
      result: null,
      events: [],
      startedAt,
      updatedAt: startedAt,
      completedAt: null,
      abortController,
      mode: input.mode,
      includeBookingPreview: input.dto.includeBookingPreview === true,
      active: true,
    }
    this.byId.set(planId, plan)
    this.byIdempotency.set(mapKey, planId)
    this.touchActiveGauge()

    if (input.mode === 'sync') {
      await this.execute(plan)
      return { kind: 'created', plan }
    }

    // Async: accept immediately; run on microtask.
    queueMicrotask(() => {
      void this.execute(plan)
    })
    return { kind: 'created', plan }
  }

  private async execute(plan: StoredApiPlan): Promise<void> {
    if (!plan.active && plan.status === 'cancelled') return
    plan.status = 'running'
    plan.updatedAt = new Date().toISOString()
    try {
      const result = await this.service.plan(plan.request, {
        signal: plan.abortController?.signal,
      })
      this.applyResult(plan, result)
    } catch {
      plan.status = 'failed'
      plan.currentStage = 'Failed'
      plan.updatedAt = new Date().toISOString()
      plan.completedAt = plan.updatedAt
      plan.active = false
      plan.abortController = null
      this.touchActiveGauge()
    }
  }

  cancel(planId: string): StoredApiPlan | undefined {
    const plan = this.byId.get(planId)
    if (!plan) return undefined

    if (!plan.active || plan.result) {
      // Already terminal — idempotent no-op.
      return plan
    }

    plan.abortController?.abort()
    plan.status = 'cancelled'
    plan.currentStage = 'Cancelled'
    plan.updatedAt = new Date().toISOString()
    plan.completedAt = plan.updatedAt
    plan.active = false
    plan.abortController = null
    const cancelEvent: TripPlannerPipelineEvent = {
      id: `api_cancel_${plan.planId}`,
      stage: 'Cancelled',
      at: plan.updatedAt,
      message: 'Cancelled via Trip Planner API',
      ok: false,
    }
    plan.events = [...plan.events, cancelEvent]
    getTripPlannerApiMetrics().incr('trip_planner_api.cancellations')
    this.touchActiveGauge()
    return plan
  }

  async retry(input: {
    planId: string
    correlationId: string
  }): Promise<
    | { kind: 'ok'; plan: StoredApiPlan }
    | { kind: 'not_found' }
    | { kind: 'conflict'; code: 'NOT_RETRYABLE' | 'INVALID_STATE' }
  > {
    const plan = this.byId.get(input.planId)
    if (!plan) return { kind: 'not_found' }

    if (plan.status === 'completed' || plan.status === 'cancelled') {
      return { kind: 'conflict', code: 'INVALID_STATE' }
    }
    if (plan.active || plan.status === 'queued' || plan.status === 'running' || plan.status === 'accepted') {
      return { kind: 'conflict', code: 'INVALID_STATE' }
    }
    if (!isRetryablePlan(plan)) {
      return { kind: 'conflict', code: 'NOT_RETRYABLE' }
    }

    getTripPlannerApiMetrics().incr('trip_planner_api.retries')
    const abortController = new AbortController()
    const now = new Date().toISOString()
    const retryKey = `${plan.idempotencyKey}::retry::${Date.now()}`
    plan.request = {
      ...plan.request,
      idempotencyKey: retryKey,
    }
    plan.correlationId = input.correlationId
    plan.status = 'running'
    plan.currentStage = 'Received'
    plan.updatedAt = now
    plan.completedAt = null
    plan.abortController = abortController
    plan.result = null
    plan.events = []
    plan.active = true
    this.touchActiveGauge()

    await this.execute(plan)
    return { kind: 'ok', plan }
  }

  private applyResult(plan: StoredApiPlan, result: TripPlannerResult): void {
    // If client cancelled while service was finishing, prefer cancelled unless
    // service already returned cancelled.
    if (plan.status === 'cancelled' && result.status !== 'cancelled') {
      plan.result = {
        ...structuredClone(result),
        status: 'cancelled',
        stage: 'Cancelled',
        failure: {
          stage: 'Cancelled',
          code: 'cancelled',
          message: 'Trip planning was cancelled.',
          retryable: true,
          correlationId: result.correlationId,
        },
      }
      plan.events = result.pipelineTimeline
      plan.currentStage = 'Cancelled'
      plan.updatedAt = new Date().toISOString()
      plan.completedAt = plan.updatedAt
      plan.active = false
      plan.abortController = null
      this.touchActiveGauge()
      return
    }

    plan.result = structuredClone(result)
    plan.events = result.pipelineTimeline
    plan.status = result.status
    plan.currentStage = result.stage
    plan.updatedAt = result.generatedAt
    plan.completedAt = result.generatedAt
    plan.correlationId = result.correlationId
    plan.active = false
    plan.abortController = null
    this.touchActiveGauge()
  }
}
