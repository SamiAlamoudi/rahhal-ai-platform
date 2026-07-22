/**
 * Sprint 115 — PipelineResult
 */

import type { PipelineContext } from './PipelineContext'
import type { PipelineMetrics } from './PipelineMetrics'
import type {
  PipelineStageResult,
  PipelineTripHints,
} from './PipelineStages'
import { SPRINT115_EXECUTION_PIPELINE_VERSION } from './PipelineStages'

export interface PipelineFinalResponse {
  headline: string
  executiveSummary: string
  narrative: string | null
  followUpQuestion: string | null
  recommendations: Array<{
    id: string | null
    title: string | null
    price: number | null
    currency: string
    reason: string | null
  }>
  conciergeHints: string[]
  warnings: string[]
  confidence: number
  source: 'pipeline' | 'disabled' | 'partial' | 'error' | 'early_exit'
}

export interface PipelineResult {
  version: string
  enabled: boolean
  ok: boolean
  empty: boolean
  partial: boolean
  conversation: {
    conversationId: string
    messagesUnderstood: number
    trip: PipelineTripHints
  } | null
  memory: Record<string, unknown> | null
  searches: Record<string, unknown> | null
  flightOffers: Array<Record<string, unknown>>
  hotelOffers: Array<Record<string, unknown>>
  decision: Record<string, unknown> | null
  trip: Record<string, unknown> | null
  itinerary: Record<string, unknown> | null
  response: Record<string, unknown> | null
  concierge: Record<string, unknown> | null
  finalResponse: PipelineFinalResponse | null
  stages: PipelineStageResult[]
  metadata: {
    conversationId: string
    userId: string | null
    memoryPresent: boolean
    stageCount: number
    completedCount: number
    skippedCount: number
    failedCount: number
    style: string | null
    destination: string | null
  }
  metrics: PipelineMetrics
  confidence: number
  warnings: string[]
  validationErrors: string[]
  logs: string[]
  latencyMs: number
  explanation: string
}

export function buildDisabledPipelineResult(
  metrics: PipelineMetrics,
  logs: string[],
): PipelineResult {
  return {
    version: SPRINT115_EXECUTION_PIPELINE_VERSION,
    enabled: false,
    ok: false,
    empty: true,
    partial: false,
    conversation: null,
    memory: null,
    searches: null,
    flightOffers: [],
    hotelOffers: [],
    decision: null,
    trip: null,
    itinerary: null,
    response: null,
    concierge: null,
    finalResponse: {
      headline: '',
      executiveSummary: '',
      narrative: null,
      followUpQuestion: null,
      recommendations: [],
      conciergeHints: [],
      warnings: [],
      confidence: 0,
      source: 'disabled',
    },
    stages: [],
    metadata: {
      conversationId: '',
      userId: null,
      memoryPresent: false,
      stageCount: 0,
      completedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      style: null,
      destination: null,
    },
    metrics,
    confidence: 0,
    warnings: [],
    validationErrors: [],
    logs: [...logs, 'execution_pipeline_disabled'],
    latencyMs: metrics.pipelineDurationMs,
    explanation: 'Execution pipeline feature flag is OFF — legacy behavior unchanged.',
  }
}

export function buildPipelineResult(input: {
  ctx: PipelineContext
  metrics: PipelineMetrics
  finalResponse: PipelineFinalResponse
  explanation: string
  validationErrors?: string[]
  logs: string[]
  latencyMs: number
  ok: boolean
  empty: boolean
  partial: boolean
}): PipelineResult {
  const stages = input.ctx.stageResults
  const completedCount = stages.filter(
    (s) => s.status === 'completed' || s.status === 'recovered',
  ).length
  const skippedCount = stages.filter((s) => s.status === 'skipped').length
  const failedCount = stages.filter(
    (s) => s.status === 'failed' || s.status === 'timed_out',
  ).length

  return {
    version: SPRINT115_EXECUTION_PIPELINE_VERSION,
    enabled: true,
    ok: input.ok,
    empty: input.empty,
    partial: input.partial,
    conversation: {
      conversationId: input.ctx.conversationId,
      messagesUnderstood:
        typeof input.ctx.artifacts.conversation?.messagesUnderstood === 'number'
          ? (input.ctx.artifacts.conversation.messagesUnderstood as number)
          : 0,
      trip: { ...input.ctx.trip },
    },
    memory: input.ctx.artifacts.memory ?? null,
    searches: input.ctx.artifacts.search_planning ?? null,
    flightOffers: input.ctx.flights.slice(),
    hotelOffers: input.ctx.hotels.slice(),
    decision: input.ctx.artifacts.decision ?? null,
    trip: input.ctx.artifacts.trip_builder ?? null,
    itinerary: input.ctx.artifacts.itinerary ?? null,
    response: input.ctx.artifacts.response_composer ?? null,
    concierge: input.ctx.artifacts.concierge ?? null,
    finalResponse: input.finalResponse,
    stages,
    metadata: {
      conversationId: input.ctx.conversationId,
      userId: input.ctx.userId,
      memoryPresent: input.ctx.memoryPresent,
      stageCount: stages.length,
      completedCount,
      skippedCount,
      failedCount,
      style: input.ctx.trip.style ?? null,
      destination: input.ctx.trip.destination ?? null,
    },
    metrics: input.metrics,
    confidence: input.ctx.confidence,
    warnings: input.ctx.warnings.slice(),
    validationErrors: input.validationErrors ?? [],
    logs: input.logs,
    latencyMs: input.latencyMs,
    explanation: input.explanation,
  }
}

export class PipelineResultBuilder {
  disabled(metrics: PipelineMetrics, logs: string[]): PipelineResult {
    return buildDisabledPipelineResult(metrics, logs)
  }

  build(
    input: Parameters<typeof buildPipelineResult>[0],
  ): PipelineResult {
    return buildPipelineResult(input)
  }
}

export function createPipelineResultBuilder(): PipelineResultBuilder {
  return new PipelineResultBuilder()
}
