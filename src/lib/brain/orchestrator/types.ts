/**
 * Sprint 27 — AI Trip Orchestrator types.
 * Orchestration only: reuses Brain, Planning, Execution, Search, Booking Flow, Providers.
 */

import type { TravelIntent } from '../types'
import type { ExecutionTaskType } from '../execution/types'
import type { BookingFlowStage } from '../../bookingFlow/types'

/** Domains the orchestrator can schedule against provider adapters. */
export type OrchestratorDomain =
  | 'flights'
  | 'hotels'
  | 'activities'
  | 'transport'
  | 'packages'

export type OrchestratorStage =
  | 'intent'
  | 'planning'
  | 'execution_plan'
  | 'provider_search'
  | 'aggregation'
  | 'booking'
  | 'complete'
  | 'failed'
  | 'cancelled'

export type OrchestratorLogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface OrchestratorLogEntry {
  at: string
  level: OrchestratorLogLevel
  stage: OrchestratorStage | 'orchestrator'
  message: string
  data?: Record<string, unknown>
}

export interface OrchestratorDomainStep {
  domain: OrchestratorDomain
  taskType: ExecutionTaskType
  priority: number
  enabled: boolean
  reason: string
}

/** Provider-independent execution plan built from conversation intent + trip context. */
export interface OrchestratorExecutionPlan {
  id: string
  conversationId: string
  intent: TravelIntent
  confidence: number
  domains: OrchestratorDomainStep[]
  requestedDomains: OrchestratorDomain[]
  createdAt: string
}

export interface OrchestratorMetrics {
  conversationId: string
  durationMs: number
  stageDurationsMs: Partial<Record<OrchestratorStage, number>>
  intent: TravelIntent | null
  domainsRequested: OrchestratorDomain[]
  domainsCompleted: OrchestratorDomain[]
  providerCalls: number
  retries: number
  timeouts: number
  cacheHit: boolean
  success: boolean
  partialSuccess: boolean
  error: string | null
}

/** Single aggregated response across search + optional booking. */
export interface OrchestratorAggregatedResponse {
  headline: string
  intent: TravelIntent
  domains: OrchestratorDomain[]
  hasTripPlan: boolean
  hasExecution: boolean
  hasSearch: boolean
  hasBookingFlow: boolean
  recommendationTopId: string | null
  recommendationConfidence: number | null
  executionState: string | null
  bookingFlowStage: BookingFlowStage | null
  bookingFlowId: string | null
  warnings: string[]
}

export interface AITripOrchestratorTurnResult {
  conversationId: string
  stage: OrchestratorStage
  intent: TravelIntent
  confidence: number
  executionPlan: OrchestratorExecutionPlan
  /** Full BrainTurnResult from the shared pipeline (planning/execution/search). */
  brain: unknown
  bookingFlowId: string | null
  bookingFlowStage: BookingFlowStage | null
  aggregated: OrchestratorAggregatedResponse
  metrics: OrchestratorMetrics
  logs: OrchestratorLogEntry[]
  cacheHit: boolean
  durationMs: number
  error: string | null
  /**
   * Sprint 28 — Conversation Memory & Context Engine snapshot (additive).
   * Present when `brain.context_memory` is on; null when disabled.
   */
  memory?: unknown | null
}

export type AITripOrchestratorOptions = {
  /** Override FeatureRegistry for this instance. */
  enabled?: boolean
  /** Attach BookingFlowController when ui.booking_flow is on (default: follow flag). */
  bookingFlow?: boolean
  /** Orchestrator-level timeout for the full turn (ms). */
  timeoutMs?: number
  /** Orchestrator-level retries for transient pipeline failures. */
  maxRetries?: number
  /** Cache successful aggregated turns (ms TTL). 0 disables. */
  cacheTtlMs?: number
  /** Structured logging sink (default: in-memory buffer on the result). */
  onLog?: (entry: OrchestratorLogEntry) => void
  /** Inject pipeline runner (tests / cycle-safe overrides). */
  runPipeline?: (
    input: import('../integration').RunIntegratedBrainTurnInput,
  ) => Promise<import('../types').BrainTurnResult>
  /**
   * Sprint 28 — override Conversation Memory & Context Engine flag for this instance.
   * Default follows FeatureRegistry `brain.context_memory`.
   */
  contextMemory?: boolean
}

export type AITripOrchestratorRunInput = {
  conversationId: string
  userText: string
  locale?: 'ar' | 'en'
  requirements?: unknown
  signal?: AbortSignal
  userId?: string
  /** Force booking flow attach on/off for this turn. */
  bookingFlow?: boolean
  /** Bypass orchestrator result cache. */
  bypassCache?: boolean
}
