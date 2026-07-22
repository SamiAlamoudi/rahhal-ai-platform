/**
 * Sprint 115 — Pipeline stage contracts and stage catalog.
 * Stages are isolated; each may be skipped safely.
 */

export const SPRINT115_EXECUTION_PIPELINE_VERSION = '1.0.0-execution-pipeline'

export type PipelineStageId =
  | 'conversation'
  | 'memory'
  | 'preference_resolution'
  | 'search_planning'
  | 'flight_search'
  | 'hotel_search'
  | 'decision'
  | 'trip_builder'
  | 'itinerary'
  | 'response_composer'
  | 'concierge'
  | 'final'

export type PipelineStageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'skipped'
  | 'failed'
  | 'timed_out'
  | 'recovered'

export interface PipelineMessage {
  role?: 'user' | 'assistant' | 'system'
  text: string
}

export interface PipelineTripHints {
  origin?: string | null
  destination?: string | null
  departureDate?: string | null
  returnDate?: string | null
  checkInDate?: string | null
  checkOutDate?: string | null
  adults?: number | null
  children?: number | null
  budget?: number | null
  currency?: string | null
  cabin?: string | null
  style?: 'leisure' | 'family' | 'business' | 'mixed' | null
}

export interface PipelineStageOverrides {
  skipMemory?: boolean | null
  skipSearchPlanning?: boolean | null
  skipFlightSearch?: boolean | null
  skipHotelSearch?: boolean | null
  skipDecision?: boolean | null
  skipTripBuilder?: boolean | null
  skipItinerary?: boolean | null
  skipResponseComposer?: boolean | null
  skipConcierge?: boolean | null
  /** Force early exit after conversation understanding. */
  earlyExit?: boolean | null
}

export interface PipelineInput {
  conversationId?: string | null
  userId?: string | null
  messages?: PipelineMessage[] | null
  trip?: PipelineTripHints | null
  /** Pre-supplied flight offers (skips live flight search when present). */
  flights?: Array<Record<string, unknown>> | null
  /** Pre-supplied hotel offers. */
  hotels?: Array<Record<string, unknown>> | null
  stageOverrides?: PipelineStageOverrides | null
  decisionConfidence?: number | null
  decisionExplanation?: string | null
  /** Per-stage timeout in ms (default 15_000). */
  stageTimeoutMs?: number | null
  /** Max recoverable retries per stage (default 0). */
  maxRetries?: number | null
  /** Continue pipeline when a stage fails recoverably (default true). */
  continueOnWarning?: boolean | null
}

export interface PipelineStageResult {
  stageId: PipelineStageId
  status: PipelineStageStatus
  durationMs: number
  warnings: string[]
  errors: string[]
  metadata: Record<string, unknown>
  /** Opaque artifact for downstream stages. */
  artifact: Record<string, unknown> | null
  confidence: number | null
  retried: number
}

export interface PipelineStageHandler {
  (
    input: PipelineInput,
    ctx: import('./PipelineContext').PipelineContext,
  ): Promise<PipelineStageResult> | PipelineStageResult
}

export const PIPELINE_STAGE_ORDER: readonly PipelineStageId[] = [
  'conversation',
  'memory',
  'preference_resolution',
  'search_planning',
  'flight_search',
  'hotel_search',
  'decision',
  'trip_builder',
  'itinerary',
  'response_composer',
  'concierge',
  'final',
] as const

export function createSkippedStageResult(
  stageId: PipelineStageId,
  reason: string,
  durationMs = 0,
): PipelineStageResult {
  return {
    stageId,
    status: 'skipped',
    durationMs,
    warnings: [],
    errors: [],
    metadata: { reason },
    artifact: { skipped: true, reason },
    confidence: null,
    retried: 0,
  }
}

export function createFailedStageResult(
  stageId: PipelineStageId,
  error: string,
  durationMs: number,
  recoverable = true,
): PipelineStageResult {
  return {
    stageId,
    status: 'failed',
    durationMs,
    warnings: recoverable ? [`recoverable:${error}`] : [],
    errors: [error],
    metadata: { recoverable },
    artifact: null,
    confidence: null,
    retried: 0,
  }
}

export function createCompletedStageResult(input: {
  stageId: PipelineStageId
  durationMs: number
  artifact?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
  warnings?: string[]
  confidence?: number | null
  status?: PipelineStageStatus
  retried?: number
}): PipelineStageResult {
  return {
    stageId: input.stageId,
    status: input.status ?? 'completed',
    durationMs: input.durationMs,
    warnings: input.warnings ?? [],
    errors: [],
    metadata: input.metadata ?? {},
    artifact: input.artifact ?? null,
    confidence: input.confidence ?? null,
    retried: input.retried ?? 0,
  }
}
