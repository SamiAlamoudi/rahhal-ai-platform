/**
 * Sprint 83 — Agent Orchestrator contracts (Brain v1 island).
 * Gated by `ai.brain.v1`. Not wired to UI / Voice / planTurn / providers.
 */

import type {
  BrainV1Entities,
  BrainV1Explanation,
  BrainV1Intent,
  BrainV1IntentResult,
  BrainV1LongTermMemory,
  BrainV1MissingField,
  BrainV1Offer,
  BrainV1PlannerState,
  BrainV1PreferenceMemory,
  BrainV1ReasoningStep,
  BrainV1ToolId,
} from '../types'

export type BrainAgentId =
  | 'planner'
  | 'memory'
  | 'travel'
  | 'flight'
  | 'hotel'
  | 'package'
  | 'weather'
  | 'maps'
  | 'visa'
  | 'pricing'
  | 'booking'
  | 'safety'
  | 'response'

export type BrainAgentLifecycle =
  | 'idle'
  | 'ready'
  | 'executing'
  | 'waiting'
  | 'recovering'
  | 'completed'
  | 'failed'

export type BrainAgentFailureKind =
  | 'timeout'
  | 'temporary_failure'
  | 'provider_unavailable'
  | 'dependency_failed'
  | 'unknown'

export interface BrainAgentRetryPolicy {
  maxAttempts: number
  timeoutMs: number
  /** Delay between retries (ms). */
  backoffMs: number
  retryOn: BrainAgentFailureKind[]
  /** Fallback agent id when retries exhaust (optional). */
  fallbackAgentId?: BrainAgentId | null
}

export const DEFAULT_AGENT_RETRY_POLICY: BrainAgentRetryPolicy = {
  maxAttempts: 3,
  timeoutMs: 50,
  backoffMs: 0,
  retryOn: ['timeout', 'temporary_failure', 'provider_unavailable'],
  fallbackAgentId: null,
}

export interface BrainAgentSelection {
  agentId: BrainAgentId
  reason: string
}

export interface BrainAgentResult {
  agentId: BrainAgentId
  ok: boolean
  detail: string
  /** Optional patch applied into shared context. */
  patch?: Partial<BrainAgentContextData>
  failureKind?: BrainAgentFailureKind
}

/** Mutable shared context data carried across agents. */
export interface BrainAgentContextData {
  text: string
  locale: 'ar' | 'en'
  intent: BrainV1IntentResult
  entities: BrainV1Entities
  missing: BrainV1MissingField[]
  tools: BrainV1ToolId[]
  conversationSummary: string | null
  preferenceMemory: BrainV1PreferenceMemory
  longTerm: BrainV1LongTermMemory | null
  planner: BrainV1PlannerState | null
  reasoning: BrainV1ReasoningStep[]
  providerResults: BrainV1Offer[]
  rankedOffers: BrainV1Offer[]
  explanation: BrainV1Explanation | null
  responseAr: string
  responseEn: string
  bookingActions: Array<{ type: string; label: string; payload?: Record<string, unknown> }>
  safe: boolean
  safetyNotes: string[]
  selectedAgents: BrainAgentSelection[]
  /** Injected candidate offers for agent stubs (no live providers). */
  candidateOffers: BrainV1Offer[]
}

export interface BrainAgentTelemetryEvent {
  agentId: BrainAgentId
  lifecycle: BrainAgentLifecycle
  startedAt: string
  endedAt: string | null
  durationMs: number
  attempts: number
  retries: number
  failures: Array<{ kind: BrainAgentFailureKind; detail: string }>
  selectedTools: BrainV1ToolId[]
  ok: boolean
  detail: string
}

export interface BrainAgentOrchestratorTelemetry {
  totalDurationMs: number
  events: BrainAgentTelemetryEvent[]
  plannerDecisions: BrainAgentSelection[]
  parallelBatches: BrainAgentId[][]
  failures: number
  retries: number
}

export interface BrainAgentDefinition {
  id: BrainAgentId
  name: string
  description: string
  /** Hard dependencies — must complete if also selected. */
  dependsOn: BrainAgentId[]
  /** Agents that may share a parallel batch with this one. */
  parallelCompatibleWith: BrainAgentId[]
  retryPolicy?: Partial<BrainAgentRetryPolicy>
  /**
   * Whether this agent should be considered by the planner for the intent.
   * Registry-driven selection — orchestrator does not hardcode order.
   */
  shouldSelect: (ctx: BrainAgentContextData) => boolean
  /** Explainability: why this agent was selected. */
  selectionReason: (ctx: BrainAgentContextData) => string
  execute: (ctx: BrainAgentContextData) => BrainAgentResult | Promise<BrainAgentResult>
}

export interface BrainAgentOrchestratorInput {
  text: string
  locale?: 'ar' | 'en'
  intent?: BrainV1IntentResult
  entities?: BrainV1Entities
  missing?: BrainV1MissingField[]
  tools?: BrainV1ToolId[]
  preferenceMemory?: BrainV1PreferenceMemory
  longTerm?: BrainV1LongTermMemory | null
  planner?: BrainV1PlannerState | null
  reasoning?: BrainV1ReasoningStep[]
  candidateOffers?: BrainV1Offer[]
  conversationSummary?: string | null
  /** Optional intent hint for planner when not pre-detected. */
  intentHint?: BrainV1Intent
}

export interface BrainAgentOrchestratorResult {
  version: string
  enabled: boolean
  context: BrainAgentContextData
  telemetry: BrainAgentOrchestratorTelemetry
  lifecycleSnapshot: Record<BrainAgentId, BrainAgentLifecycle>
  selectedAgents: BrainAgentSelection[]
  executionOrder: BrainAgentId[]
  parallelBatches: BrainAgentId[][]
}

export const BRAIN_AGENT_ORCHESTRATOR_VERSION = '1.0.0-agent-orchestrator'
