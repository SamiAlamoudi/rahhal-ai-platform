/**
 * Sprint 113 — AI Orchestrator contracts.
 * Additive coordination layer — does not modify underlying engines.
 */

export const SPRINT113_AI_ORCHESTRATOR_VERSION = '1.0.0-ai-orchestrator'

export type OrchestratorStageId =
  | 'memory'
  | 'planner'
  | 'providers'
  | 'trip_builder'
  | 'decision'
  | 'response_composer'
  | 'concierge'
  | 'final'

export type OrchestratorStageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'skipped'
  | 'failed'
  | 'cached'

export type ProviderStatusKind =
  | 'unknown'
  | 'healthy'
  | 'degraded'
  | 'unavailable'
  | 'skipped'

export interface OrchestratorMessage {
  role?: 'user' | 'assistant' | 'system'
  text: string
}

export interface OrchestratorTripHints {
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
}

export interface OrchestratorStageOverrides {
  /** Force skip / force run (planner still validates). */
  useMemory?: boolean | null
  executeSearch?: boolean | null
  reuseCache?: boolean | null
  runTripBuilder?: boolean | null
  runDecision?: boolean | null
  runResponseComposer?: boolean | null
  runConcierge?: boolean | null
  askFollowUp?: boolean | null
  skipProviders?: boolean | null
  earlyExit?: boolean | null
}

/**
 * Orchestrator input — conversation + optional pre-fetched offers / cache.
 * Engines are invoked via injectable adapters (defaults call public APIs).
 */
export interface OrchestratorInput {
  conversationId?: string | null
  userId?: string | null
  messages?: OrchestratorMessage[] | null
  trip?: OrchestratorTripHints | null
  /** Pre-supplied flight offers (skips provider search when present). */
  flights?: Array<Record<string, unknown>> | null
  /** Pre-supplied hotel offers. */
  hotels?: Array<Record<string, unknown>> | null
  /** Cached final response payload for reuse. */
  cachedFinalResponse?: OrchestratorFinalResponse | null
  /** Cache key hint — when set with cachedFinalResponse, planner may reuse. */
  cacheKey?: string | null
  providerStatus?: ProviderStatusKind | null
  stageOverrides?: OrchestratorStageOverrides | null
  /** Optional Decision Engine-shaped confidence already known. */
  decisionConfidence?: number | null
  decisionExplanation?: string | null
}

export interface OrchestratorFinalResponse {
  headline: string
  executiveSummary: string
  recommendations: Array<{
    id: string | null
    title: string | null
    price: number | null
    currency: string
    reason: string | null
  }>
  followUpQuestion: string | null
  narrative: string | null
  conciergeHints: string[]
  warnings: string[]
  confidence: number
  source: 'orchestrator' | 'cache' | 'disabled' | 'early_exit' | 'error'
}

export interface OrchestratorStageRecord {
  id: OrchestratorStageId
  status: OrchestratorStageStatus
  startedAt: string | null
  completedAt: string | null
  durationMs: number
  reason: string | null
  error: string | null
  confidence: number | null
}

export interface ExecutionPlan {
  useMemory: boolean
  executeSearch: boolean
  reuseCache: boolean
  skipProviders: boolean
  runTripBuilder: boolean
  runDecision: boolean
  runResponseComposer: boolean
  runConcierge: boolean
  askFollowUp: boolean
  earlyExit: boolean
  followUpQuestion: string | null
  reasons: string[]
  stageOrder: OrchestratorStageId[]
}

export interface ExecutionMetrics {
  pipelineDurationMs: number
  memoryDurationMs: number
  plannerDurationMs: number
  providerLatencyMs: number
  tripBuilderDurationMs: number
  decisionDurationMs: number
  responseDurationMs: number
  conciergeDurationMs: number
  totalTokens: number
  confidence: number
  stagesCompleted: number
  stagesSkipped: number
  stagesFailed: number
}

export interface ExecutionContextSnapshot {
  conversationId: string
  userId: string | null
  userProfilePresent: boolean
  memoryAvailable: boolean
  memoryUsed: boolean
  providerStatus: ProviderStatusKind
  featureFlags: {
    orchestrator: boolean
    memory: boolean | null
    tripBuilder: boolean | null
    responseComposer: boolean | null
    concierge: boolean | null
  }
  startedAt: string
  timing: Record<string, number>
  confidence: number
  errors: string[]
  logs: string[]
}

export interface OrchestratorResult {
  version: string
  enabled: boolean
  ok: boolean
  empty: boolean
  plan: ExecutionPlan | null
  context: ExecutionContextSnapshot | null
  stages: OrchestratorStageRecord[]
  metrics: ExecutionMetrics
  finalResponse: OrchestratorFinalResponse | null
  /** Opaque stage payloads for debugging / adapters (no engine internals). */
  artifacts: {
    memory: Record<string, unknown> | null
    planner: Record<string, unknown> | null
    providers: Record<string, unknown> | null
    tripBuilder: Record<string, unknown> | null
    decision: Record<string, unknown> | null
    responseComposer: Record<string, unknown> | null
    concierge: Record<string, unknown> | null
  }
  validationErrors: string[]
  logs: string[]
  latencyMs: number
}

export interface OrchestratorLogEntry {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
  meta?: Record<string, unknown>
}

export type OrchestratorStructuredLogger = (entry: OrchestratorLogEntry) => void

export function createSilentOrchestratorLogger(): OrchestratorStructuredLogger {
  return () => {
    /* retained on runner */
  }
}

export function emptyMetrics(): ExecutionMetrics {
  return {
    pipelineDurationMs: 0,
    memoryDurationMs: 0,
    plannerDurationMs: 0,
    providerLatencyMs: 0,
    tripBuilderDurationMs: 0,
    decisionDurationMs: 0,
    responseDurationMs: 0,
    conciergeDurationMs: 0,
    totalTokens: 0,
    confidence: 0,
    stagesCompleted: 0,
    stagesSkipped: 0,
    stagesFailed: 0,
  }
}
