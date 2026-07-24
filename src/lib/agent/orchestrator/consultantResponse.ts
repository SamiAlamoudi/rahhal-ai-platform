/**
 * Phase 2 Stage 3 — Unified Consultant Response entrypoints.
 *
 * Aggregates existing pipeline stage outputs into one consultant-grade package.
 * Feature flag `ai.consultant_response` default OFF.
 * Read-only · lazy · never mutates production planning.
 */

import { isConsultantResponseEnabled, CONSULTANT_RESPONSE_FEATURE_ID } from './consultantResponseFeature'
import { aggregateConsultantResponse } from './consultantResponseAggregator'
import { buildConsultantResponseFormats } from './consultantResponseFormats'
import {
  recordConsultantResponseTelemetry,
} from './consultantResponseTelemetry'
import type { ConsultantPipelineResult } from './pipelineTypes'
import type {
  ConsultantEnrichTurnLike,
  ConsultantResponsePackage,
} from './consultantResponseTypes'

export { CONSULTANT_RESPONSE_FEATURE_ID, isConsultantResponseEnabled }

/**
 * Build unified consultant response from an existing pipeline result.
 * Pure aggregation — does not re-run intelligence engines.
 */
export function buildConsultantResponsePackage(
  pipeline: ConsultantPipelineResult,
  options?: { minConfidence?: number },
): ConsultantResponsePackage {
  const t0 = Date.now()
  const aggregated = aggregateConsultantResponse(pipeline, options)
  const formats = buildConsultantResponseFormats(
    aggregated.body,
    pipeline.locale,
    aggregated.lowConfidence,
  )
  const responseGenerationMs = Math.max(0, Date.now() - t0)

  return {
    enabled: true,
    locale: pipeline.locale,
    body: aggregated.body,
    formats,
    sources: aggregated.sources,
    lowConfidence: aggregated.lowConfidence,
    telemetry: {
      responseGenerationMs,
      aggregationMs: aggregated.aggregationMs,
      confidence: aggregated.body.confidenceScore,
      questionCount: aggregated.body.clarificationQuestions.length,
      success: true,
    },
  }
}

/**
 * Gate-aware builder: returns null when `ai.consultant_response` is OFF.
 */
export function tryBuildConsultantResponsePackage(
  pipeline: ConsultantPipelineResult,
  options?: { enabled?: boolean; minConfidence?: number },
): ConsultantResponsePackage | null {
  if (!isConsultantResponseEnabled({ enabled: options?.enabled })) return null
  return buildConsultantResponsePackage(pipeline, {
    minConfidence: options?.minConfidence,
  })
}

export interface ConsultantResponseEnrichOptions {
  userText: string
  conversationId: string
  /** Explicit override for ai.consultant_response */
  enabled?: boolean
  /** When provided, avoid re-running the pipeline. */
  pipelineResult?: ConsultantPipelineResult | null
  now?: Date
}

/**
 * Attach `meta.consultantResponse` when flag ON.
 * Uses provided pipelineResult or runs the pipeline once (read-only inputs).
 * Never mutates tripPlan / reply / memory.
 */
export async function enrichTurnWithConsultantResponse<T extends ConsultantEnrichTurnLike>(
  turn: T,
  options: ConsultantResponseEnrichOptions,
): Promise<T> {
  if (!isConsultantResponseEnabled({ enabled: options.enabled })) {
    return turn
  }

  const t0 = Date.now()
  try {
    let pipeline = options.pipelineResult ?? null
    if (!pipeline) {
      const { runConsultantPipeline } = await import('./consultantPipeline')
      const requirements = turn.memory.requirements
      const toolResults =
        turn.toolBatch &&
        typeof turn.toolBatch === 'object' &&
        Array.isArray((turn.toolBatch as { results?: unknown[] }).results)
          ? (turn.toolBatch as { results: unknown[] }).results
          : undefined

      pipeline = await runConsultantPipeline({
        locale: turn.memory.locale === 'en' ? 'en' : 'ar',
        userText: options.userText,
        conversationId: options.conversationId,
        known: {
          destination: requirements.destination ?? requirements.destinations?.[0] ?? null,
          origin: requirements.origin ?? null,
          budgetAmount: requirements.budgetAmount ?? null,
          budgetCurrency: requirements.budgetCurrency ?? null,
          durationDays: requirements.durationDays ?? null,
          adults: requirements.travelers ?? null,
          interests: requirements.interests?.length ? [...requirements.interests] : undefined,
          tripPurpose: requirements.tripPurpose ?? requirements.travelerType ?? null,
        },
        tripPlan: turn.tripPlan ?? undefined,
        toolResults,
        requirements,
        enabled: true,
        now: options.now,
      })
    }

    const pkg = buildConsultantResponsePackage(pipeline)
    recordConsultantResponseTelemetry({
      success: true,
      responseGenerationMs: pkg.telemetry.responseGenerationMs,
      aggregationMs: pkg.telemetry.aggregationMs,
      confidence: pkg.telemetry.confidence,
      questionCount: pkg.telemetry.questionCount,
      failureCode: null,
    })

    return {
      ...turn,
      meta: {
        ...turn.meta,
        consultantResponse: pkg,
      },
    }
  } catch {
    recordConsultantResponseTelemetry({
      success: false,
      responseGenerationMs: Math.max(0, Date.now() - t0),
      aggregationMs: 0,
      confidence: 0,
      questionCount: 0,
      failureCode: 'response_aggregation_error',
    })
    return turn
  }
}

export const ConsultantResponse = {
  build: buildConsultantResponsePackage,
  tryBuild: tryBuildConsultantResponsePackage,
  enrichTurn: enrichTurnWithConsultantResponse,
  isEnabled: isConsultantResponseEnabled,
  featureId: CONSULTANT_RESPONSE_FEATURE_ID,
}
