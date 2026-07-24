/**
 * Phase 2 Stage 4 — AI Runtime Coordinator
 *
 * Coordinates consultant intelligence execution only.
 * Does not modify production planning or engine internals.
 * Flag `ai.runtime_coordinator` default OFF.
 */

import type { ConsultantPipelineInput, ConsultantStageId, StageIOContext } from '../pipelineTypes'
import { createInitialContext, enrichContextFromStage } from '../consultantContext'
import { isRuntimeCoordinatorEnabled, RUNTIME_COORDINATOR_FEATURE_ID } from './runtimeFeature'
import { resolveRuntimeExecutionOrder, dependentsOf } from './runtimeDependencies'
import {
  RuntimeCache,
  getSharedRuntimeCache,
  resetSharedRuntimeCache,
} from './runtimeCache'
import {
  attachStageOutput,
  createRuntimeSharedContext,
  type RuntimeSharedContext,
} from './runtimeContext'
import {
  recordRuntimeCoordinatorTelemetry,
  toTelemetrySnapshot,
} from './runtimeTelemetry'
import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_STAGE_TIMEOUT_MS,
  RUNTIME_STAGE_ORDER,
  type RuntimeCoordinatorInput,
  type RuntimeCoordinatorResult,
  type RuntimeStageId,
  type RuntimeStageRecord,
  type RuntimeLocale,
} from './runtimeTypes'

export { RUNTIME_COORDINATOR_FEATURE_ID, isRuntimeCoordinatorEnabled }
export { resetSharedRuntimeCache, getSharedRuntimeCache }

type PipelineStageId = Exclude<ConsultantStageId, 'unified_response'>

const PIPELINE_STAGE_MAP: Partial<Record<RuntimeStageId, PipelineStageId>> = {
  reflection: 'reflection',
  traveler_intelligence: 'traveler_intelligence',
  planning_graph: 'planning_graph',
  destination_intelligence: 'destination_intelligence',
  recommendation_intelligence: 'recommendation_intelligence',
  travel_strategy: 'travel_strategy',
}

function isCancelled(signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted)
}

class StageTimeoutError extends Error {
  constructor(stageId: string) {
    super(`timeout:${stageId}`)
    this.name = 'StageTimeoutError'
  }
}

async function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  stageId: string,
  signal?: AbortSignal,
): Promise<T> {
  if (isCancelled(signal)) {
    const err = new Error('cancelled')
    err.name = 'AbortError'
    throw err
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StageTimeoutError(stageId)), ms)
  })
  const abortPromise = signal
    ? new Promise<never>((_, reject) => {
        const onAbort = () => {
          const err = new Error('cancelled')
          err.name = 'AbortError'
          reject(err)
        }
        if (signal.aborted) onAbort()
        else signal.addEventListener('abort', onAbort, { once: true })
      })
    : null

  try {
    const racers: Promise<T>[] = [work, timeoutPromise as Promise<T>]
    if (abortPromise) racers.push(abortPromise as Promise<T>)
    return await Promise.race(racers)
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function toPipelineInput(
  input: RuntimeCoordinatorInput,
  locale: RuntimeLocale,
): ConsultantPipelineInput {
  return {
    locale,
    userText: input.userText,
    conversationId: input.conversationId,
    known: input.known,
    tripPlan: input.tripPlan,
    toolResults: input.toolResults,
    requirements: input.requirements,
    enabled: true,
    now: input.now,
    minConfidence: 0.1,
  }
}

function contextHash(ctx: RuntimeSharedContext, stageId: RuntimeStageId): string {
  return RuntimeCache.hashContext({
    stageId,
    locale: ctx.locale,
    userTextLen: ctx.userText.length,
    known: ctx.known,
    // Prior stage ids only (not payloads) — immutable identity for cache reuse.
    priorStages: Object.keys(ctx.stageOutputs).sort(),
  })
}

async function runPipelineMappedStage(
  stageId: PipelineStageId,
  ioCtx: StageIOContext,
  pipelineInput: ConsultantPipelineInput,
): Promise<{ output: unknown; confidence: number; evidence: string[]; missing: string[] }> {
  const { executeConsultantStage } = await import('../consultantExecution')
  const result = await executeConsultantStage(stageId, ioCtx, pipelineInput)
  return {
    output: result.output,
    confidence: result.confidence,
    evidence: result.evidence,
    missing: result.missingInformation,
  }
}

async function runUnifiedResponseStage(
  shared: RuntimeSharedContext,
  ioCtx: StageIOContext,
  stageRecords: RuntimeStageRecord[],
): Promise<{ output: unknown; confidence: number; evidence: string[]; missing: string[] }> {
  const { buildUnifiedConsultantResponse } = await import('../consultantOutputs')
  const { buildConsultantResponsePackage } = await import('../consultantResponse')

  // Build a pipeline-shaped result from shared bags (no re-execution).
  const stages = stageRecords
    .filter((s) => s.status === 'completed' || s.status === 'cached')
    .map((s) => ({
      stageId: (PIPELINE_STAGE_MAP[s.stageId] ?? 'reasoning') as ConsultantStageId,
      status: 'completed' as const,
      confidence: shared.confidence,
      evidence: [] as string[],
      missingInformation: [] as string[],
      questions: [] as string[],
      output: s.output,
      durationMs: s.durationMs,
    }))

  const pipelineLike = {
    locale: shared.locale,
    enabled: true as const,
    stages,
    context: ioCtx,
    response: buildUnifiedConsultantResponse({
      locale: shared.locale,
      context: ioCtx,
      stages,
      stoppedEarly: false,
      stoppedAtStage: null,
    }),
    stoppedEarly: false,
    stopReason: null,
    totalDurationMs: 0,
  }

  const pkg = buildConsultantResponsePackage(pipelineLike)
  return {
    output: pkg,
    confidence: pkg.body.confidenceScore,
    evidence: pkg.body.evidenceSummary.slice(0, 8),
    missing: pkg.body.missingInformation.slice(0, 8),
  }
}

/**
 * Execute consultant intelligence through the Runtime Coordinator.
 * Read-only coordination — never mutates production planning artifacts.
 */
export async function runRuntimeCoordinator(
  input: RuntimeCoordinatorInput,
  options?: {
    cache?: RuntimeCache
  },
): Promise<RuntimeCoordinatorResult> {
  const t0 = Date.now()
  const locale: RuntimeLocale = input.locale === 'en' ? 'en' : 'ar'
  const sessionId =
    input.sessionId
    ?? input.conversationId
    ?? `runtime_${Date.now().toString(36)}`
  const stageTimeoutMs = input.stageTimeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS
  const maxRetries = input.maxRetries ?? DEFAULT_MAX_RETRIES
  const requested = input.stages?.length
    ? input.stages
    : [...RUNTIME_STAGE_ORDER]
  const executionOrder = resolveRuntimeExecutionOrder(requested)
  const cache = options?.cache ?? getSharedRuntimeCache()

  let shared = createRuntimeSharedContext({
    locale,
    userText: input.userText,
    conversationId: input.conversationId ?? sessionId,
    sessionId,
    known: input.known,
    tripPlan: input.tripPlan,
    requirements: input.requirements,
    toolResults: input.toolResults,
  })

  let ioCtx = createInitialContext(toPipelineInput(input, locale))
  const pipelineInput = toPipelineInput(input, locale)
  const records: RuntimeStageRecord[] = []
  const skipped = new Set<RuntimeStageId>()
  let retries = 0
  let timeouts = 0
  let failures = 0
  let cancelled = false
  let consultantResponse: unknown | null = null

  for (const stageId of executionOrder) {
    if (isCancelled(input.signal)) {
      cancelled = true
      records.push({
        stageId,
        status: 'cancelled',
        durationMs: 0,
        attempts: 0,
        cacheHit: false,
        errorCode: 'cancelled',
        output: null,
      })
      continue
    }

    if (skipped.has(stageId)) {
      records.push({
        stageId,
        status: 'skipped',
        durationMs: 0,
        attempts: 0,
        cacheHit: false,
        errorCode: 'dependency_failed',
        output: null,
      })
      continue
    }

    // Only run stages that were requested (prereqs may be expanded).
    const explicitlyWanted = !input.stages || input.stages.includes(stageId)
    if (!explicitlyWanted && stageId === 'unified_consultant_response') {
      // If response wasn't requested, skip even if expanded — expansion shouldn't add it
      // unless it's a dependency (it isn't for others).
    }

    const hash = contextHash(shared, stageId)
    const cacheKey = cache.makeKey(sessionId, stageId, hash)
    const cached = cache.get(cacheKey)
    if (cached) {
      shared = attachStageOutput(shared, stageId, cached.output, {
        evidence: [`cache:hit:${stageId}`],
      })
      if (stageId !== 'unified_consultant_response') {
        const mapped = PIPELINE_STAGE_MAP[stageId]
        if (mapped && ioCtx.stageOutputs[mapped] === undefined) {
          ioCtx = {
            ...ioCtx,
            stageOutputs: { ...ioCtx.stageOutputs, [mapped]: cached.output },
          }
        }
      } else {
        consultantResponse = cached.output
      }
      records.push({
        stageId,
        status: 'cached',
        durationMs: 0,
        attempts: 0,
        cacheHit: true,
        errorCode: null,
        output: cached.output,
      })
      continue
    }

    let attempts = 0
    let lastError: string | null = null
    let output: unknown = null
    let status: RuntimeStageRecord['status'] = 'failed'
    let durationMs = 0
    const stageStart = Date.now()

    const fault = input.faultInject?.[stageId]
    if (fault === 'timeout') {
      timeouts += 1
      failures += 1
      for (const dep of dependentsOf(stageId)) skipped.add(dep)
      records.push({
        stageId,
        status: 'timeout',
        durationMs: 0,
        attempts: 1,
        cacheHit: false,
        errorCode: `timeout:${stageId}`,
        output: null,
      })
      continue
    }

    while (attempts <= maxRetries) {
      attempts += 1
      if (attempts > 1) retries += 1
      try {
        if (fault === 'throw') {
          throw new Error(`fault_inject:${stageId}`)
        }
        const work =
          stageId === 'unified_consultant_response'
            ? runUnifiedResponseStage(shared, ioCtx, records)
            : (async () => {
                const mapped = PIPELINE_STAGE_MAP[stageId]
                if (!mapped) throw new Error(`unmapped_stage:${stageId}`)
                return runPipelineMappedStage(mapped, ioCtx, pipelineInput)
              })()

        const result = await withTimeout(work, stageTimeoutMs, stageId, input.signal)
        output = result.output
        shared = attachStageOutput(shared, stageId, result.output, {
          evidence: result.evidence,
          missing: result.missing,
          confidence: result.confidence,
        })

        if (stageId === 'unified_consultant_response') {
          consultantResponse = result.output
        } else {
          const mapped = PIPELINE_STAGE_MAP[stageId]!
          const fakeStageResult = {
            stageId: mapped,
            status: 'completed' as const,
            confidence: result.confidence,
            evidence: result.evidence,
            missingInformation: result.missing,
            questions: [] as string[],
            output: result.output,
            durationMs: 0,
          }
          ioCtx = enrichContextFromStage(ioCtx, fakeStageResult)
        }

        cache.set({
          stageId,
          key: cacheKey,
          output: result.output,
          createdAt: Date.now(),
        })
        status = 'completed'
        lastError = null
        break
      } catch (err) {
        const name = err instanceof Error ? err.name : 'Error'
        const message = err instanceof Error ? err.message : 'unknown'
        if (name === 'AbortError' || message === 'cancelled') {
          cancelled = true
          status = 'cancelled'
          lastError = 'cancelled'
          break
        }
        if (name === 'StageTimeoutError' || message.startsWith('timeout:')) {
          timeouts += 1
          status = 'timeout'
          lastError = `timeout:${stageId}`
          // Timeouts are not retried by default (fail-isolated).
          break
        }
        lastError = message.slice(0, 80)
        status = 'failed'
        if (attempts > maxRetries) break
      }
    }

    durationMs = Math.max(0, Date.now() - stageStart)
    if (status === 'failed' || status === 'timeout') {
      failures += 1
      for (const dep of dependentsOf(stageId)) skipped.add(dep)
    }

    records.push({
      stageId,
      status,
      durationMs,
      attempts,
      cacheHit: false,
      errorCode: lastError,
      output,
    })

    if (cancelled) break
  }

  const cacheStats = cache.stats()
  const stageDurations: Record<string, number> = {}
  for (const r of records) stageDurations[r.stageId] = r.durationMs

  const telemetry = toTelemetrySnapshot({
    executionOrder,
    stageDurations,
    cacheHits: cacheStats.hits,
    cacheMisses: cacheStats.misses,
    retries,
    timeouts,
    failures,
    totalDurationMs: Math.max(0, Date.now() - t0),
  })

  const success =
    !cancelled
    && records.some((r) => r.status === 'completed' || r.status === 'cached')
    && failures === 0

  recordRuntimeCoordinatorTelemetry({
    success,
    executionOrder,
    stageDurations,
    cacheHits: telemetry.cacheHits,
    cacheMisses: telemetry.cacheMisses,
    retries,
    timeouts,
    failures,
    totalDurationMs: telemetry.totalDurationMs,
    failureCode: cancelled ? 'cancelled' : failures ? 'stage_failures' : null,
  })

  return {
    enabled: true,
    locale,
    sessionId,
    executionOrder,
    stages: records,
    sharedContext: {
      ...shared.stageOutputs,
      evidence: shared.evidence,
      missingInformation: shared.missingInformation,
      confidence: shared.confidence,
    },
    cancelled,
    success,
    telemetry,
    consultantResponse,
  }
}

export async function tryRunRuntimeCoordinator(
  input: RuntimeCoordinatorInput,
  options?: { cache?: RuntimeCache },
): Promise<RuntimeCoordinatorResult | null> {
  if (!isRuntimeCoordinatorEnabled({ enabled: input.enabled })) return null
  return runRuntimeCoordinator(input, options)
}

export interface RuntimeTurnLike {
  reply: string
  memory: unknown
  tripPlan: unknown
  meta: Record<string, unknown> | object
  toolBatch: unknown
}

/**
 * planTurn enrichment via Runtime Coordinator (read-only meta attach).
 */
export async function enrichTurnWithRuntimeCoordinator<T extends RuntimeTurnLike>(
  turn: T,
  options: {
    userText: string
    conversationId: string
    enabled?: boolean
    signal?: AbortSignal
    stageTimeoutMs?: number
    maxRetries?: number
    now?: Date
  },
): Promise<T> {
  if (!isRuntimeCoordinatorEnabled({ enabled: options.enabled })) return turn

  try {
    const memory = turn.memory as {
      locale?: string
      requirements?: {
        destination?: string | null
        destinations?: string[]
        origin?: string | null
        budgetAmount?: number | null
        budgetCurrency?: string | null
        durationDays?: number | null
        travelers?: number | null
        interests?: string[]
        tripPurpose?: string | null
        travelerType?: string | null
      }
    }
    const req = memory.requirements ?? {}
    const toolResults =
      turn.toolBatch &&
      typeof turn.toolBatch === 'object' &&
      Array.isArray((turn.toolBatch as { results?: unknown[] }).results)
        ? (turn.toolBatch as { results: unknown[] }).results
        : undefined

    const result = await runRuntimeCoordinator({
      locale: memory.locale === 'en' ? 'en' : 'ar',
      userText: options.userText,
      conversationId: options.conversationId,
      sessionId: options.conversationId,
      known: {
        destination: req.destination ?? req.destinations?.[0] ?? null,
        origin: req.origin ?? null,
        budgetAmount: req.budgetAmount ?? null,
        budgetCurrency: req.budgetCurrency ?? null,
        durationDays: req.durationDays ?? null,
        adults: req.travelers ?? null,
        interests: req.interests?.length ? [...req.interests] : undefined,
        tripPurpose: req.tripPurpose ?? req.travelerType ?? null,
      },
      tripPlan: turn.tripPlan ?? undefined,
      requirements: req,
      toolResults,
      signal: options.signal,
      stageTimeoutMs: options.stageTimeoutMs,
      maxRetries: options.maxRetries,
      enabled: true,
      now: options.now,
    })

    return {
      ...turn,
      meta: {
        ...(turn.meta as Record<string, unknown>),
        runtimeCoordinator: {
          enabled: true as const,
          sessionId: result.sessionId,
          executionOrder: result.executionOrder,
          success: result.success,
          cancelled: result.cancelled,
          stageCount: result.stages.length,
          telemetry: result.telemetry,
          stages: result.stages.map((s) => ({
            stageId: s.stageId,
            status: s.status,
            durationMs: s.durationMs,
            cacheHit: s.cacheHit,
            errorCode: s.errorCode,
          })),
        },
        ...(result.consultantResponse
          ? { consultantResponse: result.consultantResponse }
          : {}),
      },
    }
  } catch {
    return turn
  }
}

export const RuntimeCoordinator = {
  run: runRuntimeCoordinator,
  tryRun: tryRunRuntimeCoordinator,
  enrichTurn: enrichTurnWithRuntimeCoordinator,
  isEnabled: isRuntimeCoordinatorEnabled,
  featureId: RUNTIME_COORDINATOR_FEATURE_ID,
  stageOrder: RUNTIME_STAGE_ORDER,
}
