/**
 * Phase 2 Stage 1 — Consultant Pipeline types.
 * Orchestration contracts only. No intelligence algorithms.
 */

export type ConsultantPipelineLocale = 'ar' | 'en'

/** Ordered stage identifiers for the consultant pipeline. */
export type ConsultantStageId =
  | 'conversation'
  | 'decision'
  | 'reasoning'
  | 'reflection'
  | 'planning_graph'
  | 'traveler_intelligence'
  | 'destination_intelligence'
  | 'recommendation_intelligence'
  | 'travel_strategy'
  | 'unified_response'

export type ConsultantStageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'skipped'
  | 'stopped'
  | 'clarification'

export interface TravelerSnapshotView {
  purpose?: string | null
  pace?: string | null
  budgetStance?: string | null
  riskTolerance?: string | null
  partySize?: number | null
  interests?: string[]
  summary?: string | null
  confidence?: number | null
}

export interface PlanningSnapshotView {
  destinations?: string[]
  durationDays?: number | null
  budgetAmount?: number | null
  budgetCurrency?: string | null
  monthHint?: number | null
  confidence?: number | null
  planNodeId?: string | null
  graphId?: string | null
}

/**
 * Shared bag passed into / out of every stage.
 * Stage outputs live under `stageOutputs[stageId]` — never overwrite another stage.
 */
export interface StageIOContext {
  locale: ConsultantPipelineLocale
  userText: string
  known: {
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
    compareWith?: string | null
  }
  confidence: number
  evidence: string[]
  missingInformation: string[]
  questions: string[]
  travelerSnapshot: TravelerSnapshotView
  planningSnapshot: PlanningSnapshotView
  /** Append-only map of prior stage payloads (opaque). */
  stageOutputs: Partial<Record<ConsultantStageId, unknown>>
}

export interface StageResult {
  stageId: ConsultantStageId
  status: ConsultantStageStatus
  /** Confidence produced by this stage alone. */
  confidence: number
  evidence: string[]
  missingInformation: string[]
  questions: string[]
  travelerSnapshot?: Partial<TravelerSnapshotView>
  planningSnapshot?: Partial<PlanningSnapshotView>
  /** Opaque module output — stored under stageOutputs[stageId] only. */
  output: unknown
  /** Wall time for this stage (ms). */
  durationMs: number
  notes?: string[]
}

export interface ConsultantPipelineInput {
  locale?: ConsultantPipelineLocale
  userText: string
  conversationId?: string
  known?: StageIOContext['known']
  /** Optional Decision Engine payloads (when available). */
  tripPlan?: unknown
  toolResults?: unknown[]
  /** Optional requirements for Planning Draft / Decision enrichment. */
  requirements?: unknown
  /** Force enable regardless of registry (tests / explicit callers). */
  enabled?: boolean
  /** Stop when stage confidence falls below this (default 0.35). */
  minConfidence?: number
  now?: Date
}

/**
 * Unified consultant response — single coherent output of the pipeline.
 */
export interface UnifiedConsultantResponse {
  travelerUnderstanding: string[]
  destinationUnderstanding: string[]
  recommendedStrategy: string[]
  alternative: string[]
  tradeoffs: string[]
  risks: string[]
  budgetImpact: string[]
  timeImpact: string[]
  confidence: number
  questions: string[]
  /** True when pipeline stopped early for clarification. */
  needsClarification: boolean
  stoppedAtStage: ConsultantStageId | null
  locale: ConsultantPipelineLocale
}

export interface ConsultantPipelineResult {
  locale: ConsultantPipelineLocale
  enabled: true
  stages: StageResult[]
  context: StageIOContext
  response: UnifiedConsultantResponse
  stoppedEarly: boolean
  stopReason: string | null
  totalDurationMs: number
}

export const CONSULTANT_STAGE_ORDER: readonly ConsultantStageId[] = [
  'conversation',
  'decision',
  'reasoning',
  'reflection',
  'planning_graph',
  'traveler_intelligence',
  'destination_intelligence',
  'recommendation_intelligence',
  'travel_strategy',
  'unified_response',
] as const

export const DEFAULT_MIN_CONFIDENCE = 0.35

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

export function isoNow(now?: Date): string {
  return (now ?? new Date()).toISOString()
}
