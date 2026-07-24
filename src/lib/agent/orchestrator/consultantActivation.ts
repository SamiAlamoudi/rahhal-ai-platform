/**
 * Phase 2 Stage 2 — Consultant Pipeline activation (safe planTurn integration).
 *
 * Read-only enrichment after production planning.
 * Never mutates tripPlan, itinerary, pricing, destinations, or reply text.
 * Invoked only when `ai.consultant_pipeline` is ON (default OFF).
 */

import type { AgentMemory, AgentProviderMeta, TripPlan, TripRequirements } from '../types'
import { isConsultantPipelineEnabled } from './consultantStages'
import {
  recordConsultantPipelineTelemetry,
  type ConsultantPipelineTelemetryEvent,
} from './consultantTelemetry'
import type {
  ConsultantPipelineResult,
  UnifiedConsultantResponse,
} from './pipelineTypes'

/** Read-only enrichment snapshot attached to AgentProviderMeta. */
export interface ConsultantPipelineActivationSnapshot {
  enabled: true
  travelerUnderstanding: string[]
  destinationUnderstanding: string[]
  travelStrategy: string[]
  recommendationSummary: string[]
  alternative: string[]
  tradeoffs: string[]
  risks: string[]
  confidence: number
  missingInformation: string[]
  clarificationQuestions: string[]
  needsClarification: boolean
  stoppedEarly: boolean
  stopReason: string | null
  telemetry: {
    totalDurationMs: number
    stageTimings: Record<string, number>
    clarificationCount: number
    success: boolean
    stageCount: number
  }
}

export interface ConsultantActivationTurnLike {
  reply: string
  memory: AgentMemory
  tripPlan: TripPlan | null
  meta: AgentProviderMeta
  toolBatch: unknown
}

export interface ConsultantActivationOptions {
  userText: string
  conversationId: string
  /** Explicit override (tests). When omitted, uses feature registry. */
  enabled?: boolean
  now?: Date
}

function knownFromRequirements(req: TripRequirements): {
  destination?: string | null
  origin?: string | null
  budgetAmount?: number | null
  budgetCurrency?: string | null
  durationDays?: number | null
  adults?: number | null
  children?: number | null
  monthHint?: number | null
  interests?: string[]
  tripPurpose?: string | null
} {
  const travelers = req.travelers
  return {
    destination: req.destination ?? req.destinations?.[0] ?? null,
    origin: req.origin ?? null,
    budgetAmount: req.budgetAmount ?? null,
    budgetCurrency: req.budgetCurrency ?? null,
    durationDays: req.durationDays ?? null,
    adults: travelers != null ? travelers : null,
    children: null,
    monthHint: null,
    interests: req.interests?.length ? [...req.interests] : undefined,
    tripPurpose: req.tripPurpose ?? req.travelerType ?? null,
  }
}

function toActivationSnapshot(
  pipeline: ConsultantPipelineResult,
  telemetry: ConsultantPipelineTelemetryEvent,
): ConsultantPipelineActivationSnapshot {
  const response: UnifiedConsultantResponse = pipeline.response
  return {
    enabled: true,
    travelerUnderstanding: [...response.travelerUnderstanding],
    destinationUnderstanding: [...response.destinationUnderstanding],
    travelStrategy: [...response.recommendedStrategy],
    recommendationSummary: [
      ...response.recommendedStrategy.slice(0, 3),
      ...response.budgetImpact.slice(0, 2),
      ...response.timeImpact.slice(0, 2),
    ].slice(0, 8),
    alternative: [...response.alternative],
    tradeoffs: [...response.tradeoffs],
    risks: [...response.risks],
    confidence: response.confidence,
    missingInformation: [...pipeline.context.missingInformation].slice(0, 12),
    clarificationQuestions: [...response.questions],
    needsClarification: response.needsClarification,
    stoppedEarly: pipeline.stoppedEarly,
    stopReason: pipeline.stopReason,
    telemetry: {
      totalDurationMs: telemetry.totalDurationMs,
      stageTimings: { ...telemetry.stageTimings },
      clarificationCount: telemetry.clarificationCount,
      success: telemetry.success,
      stageCount: telemetry.stageCount,
    },
  }
}

function stageTimingsFrom(pipeline: ConsultantPipelineResult): Record<string, number> {
  const timings: Record<string, number> = {}
  for (const stage of pipeline.stages) {
    timings[stage.stageId] = stage.durationMs
  }
  return timings
}

/**
 * After production planning: optionally run Consultant Pipeline and attach
 * read-only meta. Returns the same tripPlan/memory/reply references when OFF
 * or when enrichment succeeds (meta is a new object; plan objects untouched).
 */
export async function enrichTurnWithConsultantPipeline<T extends ConsultantActivationTurnLike>(
  turn: T,
  options: ConsultantActivationOptions,
): Promise<T> {
  // Fast path — zero pipeline cost while disabled.
  if (!isConsultantPipelineEnabled({ enabled: options.enabled })) {
    return turn
  }

  const t0 = Date.now()
  try {
    const { runConsultantPipeline } = await import('./consultantPipeline')
    const locale = turn.memory.locale === 'en' ? 'en' : 'ar'
    const requirements = turn.memory.requirements
    const toolResults =
      turn.toolBatch &&
      typeof turn.toolBatch === 'object' &&
      Array.isArray((turn.toolBatch as { results?: unknown[] }).results)
        ? (turn.toolBatch as { results: unknown[] }).results
        : undefined

    const pipeline = await runConsultantPipeline({
      locale,
      userText: options.userText,
      conversationId: options.conversationId,
      known: knownFromRequirements(requirements),
      // Read-only inputs for Decision / Planning Draft stages — never written back.
      tripPlan: turn.tripPlan ?? undefined,
      toolResults,
      requirements,
      enabled: true,
      now: options.now,
    })

    const clarificationCount = pipeline.response.questions.length
    const telemetry = recordConsultantPipelineTelemetry({
      success: true,
      totalDurationMs: Math.max(0, Date.now() - t0),
      stageTimings: stageTimingsFrom(pipeline),
      confidence: pipeline.response.confidence,
      clarificationCount,
      stoppedEarly: pipeline.stoppedEarly,
      stageCount: pipeline.stages.length,
      failureCode: null,
    })

    const snapshot = toActivationSnapshot(pipeline, telemetry)

    // Enrich meta only — never replace production planning outputs.
    return {
      ...turn,
      meta: {
        ...turn.meta,
        consultantPipeline: snapshot,
      },
    }
  } catch {
    recordConsultantPipelineTelemetry({
      success: false,
      totalDurationMs: Math.max(0, Date.now() - t0),
      stageTimings: {},
      confidence: 0,
      clarificationCount: 0,
      stoppedEarly: true,
      stageCount: 0,
      failureCode: 'pipeline_execution_error',
    })
    // Fail open — production turn unchanged on pipeline errors.
    return turn
  }
}

export const ConsultantActivation = {
  enrichTurn: enrichTurnWithConsultantPipeline,
  isEnabled: isConsultantPipelineEnabled,
}
