/**
 * Sprint 85 — Tool Execution Engine contracts (Brain v1 island).
 * Gated by `ai.brain.v1`. Mock execution only — no real providers / booking / UI / Voice.
 */

import type { TravelPlan, TravelPlanSlots } from '../planning/types'

export const TOOL_EXECUTION_ENGINE_VERSION = '1.0.0-tool-execution-engine'

/** Supported executable tool types (simulator-backed). */
export type ExecutableToolType =
  | 'flights'
  | 'hotels'
  | 'packages'
  | 'weather'
  | 'maps'
  | 'visa'
  | 'knowledge'
  | 'currency'
  | 'pricing'
  | 'calendar'
  | 'booking'
  | 'external_api'

export type ExecutionPolicyKind =
  | 'sequential'
  | 'parallel'
  | 'conditional'
  | 'retry'
  | 'timeout'
  | 'fallback'
  | 'skip'
  | 'cancel'

export type ToolExecutionStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'cancelled'
  | 'fallback'

export interface ToolDecision {
  tool: ExecutableToolType
  /** Why this tool was selected. */
  reason: string
  /** Parameters derived from plan/slots (never provider-specific). */
  params: Record<string, unknown>
  policy?: ExecutionPolicyKind
  /** Soft/hard dependencies on other tools. */
  dependsOn?: ExecutableToolType[]
  /** Fallback tool if this one fails. */
  fallback?: ExecutableToolType | null
  /** Conditional gate — skip when false. */
  when?: boolean
  priority?: number
}

export interface CancellationToken {
  cancelled: boolean
  reason: string | null
  cancel: (reason?: string) => void
}

export interface ExecutionTelemetryEvent {
  tool: ExecutableToolType
  selected: boolean
  startedAt: string
  endedAt: string | null
  durationMs: number
  attempts: number
  retries: number
  failures: string[]
  fallbackUsed: ExecutableToolType | null
  success: boolean
  status: ToolExecutionStatus
  policy: ExecutionPolicyKind
}

export interface ExecutionTelemetry {
  totalDurationMs: number
  events: ExecutionTelemetryEvent[]
  parallelBatches: ExecutableToolType[][]
  failures: number
  retries: number
  fallbacks: number
}

/** Unified, provider-agnostic tool result. */
export interface UnifiedToolResult {
  tool: ExecutableToolType
  ok: boolean
  status: ToolExecutionStatus
  /** Normalized items — never raw provider payloads. */
  items: UnifiedResultItem[]
  summary: string
  meta: {
    simulated: true
    source: 'execution_simulator'
    attempts: number
    fallbackFrom?: ExecutableToolType | null
  }
}

export interface UnifiedResultItem {
  id: string
  kind: ExecutableToolType
  title: string
  subtitle?: string
  amount?: number | null
  currency?: string | null
  score?: number | null
  tags?: string[]
  attributes?: Record<string, string | number | boolean | null>
}

export interface MergedExecutionResults {
  byTool: Partial<Record<ExecutableToolType, UnifiedToolResult>>
  items: UnifiedResultItem[]
  summary: string
}

export interface ExecutionContextSnapshot {
  conversationSummary: string | null
  memoryNotes: string[]
  travelPlan: TravelPlan | null
  knownSlots: TravelPlanSlots | null
  previousResults: UnifiedToolResult[]
  telemetry: ExecutionTelemetry
  cancellation: CancellationToken
}

export interface ToolExecutionRequest {
  decisions: ToolDecision[]
  conversationSummary?: string | null
  memoryNotes?: string[]
  travelPlan?: TravelPlan | null
  knownSlots?: TravelPlanSlots | null
  previousResults?: UnifiedToolResult[]
  /** Default policy for unordered decisions. */
  defaultPolicy?: ExecutionPolicyKind
  /** Injected failure mode for tests. */
  failureInjector?: Partial<Record<ExecutableToolType, { failAttempts: number; error: string }>>
  /** Rate-limit simulation map (calls allowed). */
  rateLimits?: Partial<Record<ExecutableToolType, number>>
  /** Permission map — false blocks the tool. */
  permissions?: Partial<Record<ExecutableToolType, boolean>>
  /** Available tools — missing => unavailable. */
  availableTools?: ExecutableToolType[]
  /** Optional external cancellation token. */
  cancellationToken?: CancellationToken
}

export interface ToolExecutionResponse {
  version: string
  enabled: boolean
  results: UnifiedToolResult[]
  merged: MergedExecutionResults
  telemetry: ExecutionTelemetry
  batches: ExecutableToolType[][]
  cancelled: boolean
  safetyBlocks: Array<{ tool: ExecutableToolType; reason: string }>
  context: ExecutionContextSnapshot
}

export interface ToolExecutorOptions {
  timeoutMs?: number
  maxAttempts?: number
  backoffMs?: number
}
