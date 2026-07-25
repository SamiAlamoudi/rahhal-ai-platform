/**
 * Phase 6 — AI Agent Runtime & Tool Execution models.
 * Connects existing CI + llmBrain modules into one executable runtime.
 * Mock tools only — no production APIs.
 */

import type { LiveTravelMemory } from '../conversationIntelligence'
import type {
  ArabicDialect,
  ConfidenceLevel,
  ConversationStateSnapshot,
  ToolDecisionKind,
  TravelReasoningResult,
} from '../llmBrain'

export type RuntimeLocale = 'ar' | 'en'

export type ToolLifecycleStatus =
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'retry'
  | 'cancelled'
  | 'timeout'

export type RuntimeToolId =
  | 'flights'
  | 'hotels'
  | 'weather'
  | 'visa'
  | 'currency'
  | 'maps'
  | 'restaurants'
  | 'activities'
  | 'none'

export type RuntimeEventType =
  | 'ThinkingStarted'
  | 'ToolStarted'
  | 'ToolFinished'
  | 'MemoryUpdated'
  | 'ReasoningFinished'
  | 'StreamingStarted'
  | 'StreamingFinished'
  | 'Interrupted'
  | 'Resumed'

export type VoiceRuntimeState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted'

export interface RuntimeEvent {
  type: RuntimeEventType
  at: string
  detail: string
  meta?: Record<string, unknown>
}

export interface ToolExecutionRecord {
  toolId: RuntimeToolId
  status: ToolLifecycleStatus
  startedAt: string | null
  finishedAt: string | null
  attempt: number
  resultSummary: string | null
  error: string | null
  durationMs: number
}

export interface ExecutionTraceStep {
  stage: string
  detail: string
  at: string
  durationMs?: number
}

export interface SyncedRuntimeState {
  conversation: ConversationStateSnapshot
  voice: VoiceRuntimeState
  executionPhase: 'idle' | 'thinking' | 'tooling' | 'composing' | 'streaming' | 'paused'
  memory: LiveTravelMemory
}

export interface AgentRuntimeResult {
  enabled: true
  locale: RuntimeLocale
  dialect: ArabicDialect
  intent: string
  toolDecision: ToolDecisionKind
  toolExecution: ToolExecutionRecord | null
  reasoning: TravelReasoningResult
  confidence: ConfidenceLevel
  memory: LiveTravelMemory
  responseText: string
  spokenText: string
  streamedChunks: string[]
  events: RuntimeEvent[]
  trace: ExecutionTraceStep[]
  synced: SyncedRuntimeState
  interrupted: boolean
  durationMs: number
}

export interface AgentRuntimeInput {
  userText: string
  locale?: RuntimeLocale
  priorMemory?: LiveTravelMemory | null
  recentTexts?: string[]
  /** Simulate user interruption mid-pipeline */
  interruptAfter?: 'thinking' | 'tool' | 'reasoning' | null
  /** Force a tool failure once (for retry tests) */
  forceToolFailureOnce?: boolean
  voiceState?: VoiceRuntimeState
  sessionId?: string
}

export interface AgentRuntimeMetaSnapshot {
  intent: string
  dialect: string
  tool: string
  toolStatus: string | null
  confidence: string
  eventCount: number
  traceCount: number
  interrupted: boolean
  durationMs: number
  responsePreview: string
  /** Debug timeline — hidden in production UI */
  events?: Array<{ type: string; detail: string }>
}
