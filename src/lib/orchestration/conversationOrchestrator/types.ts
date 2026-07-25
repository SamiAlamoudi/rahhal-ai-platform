/**
 * Phase 6 Stage 2 — AI Conversation Orchestrator contracts.
 * Architecture / interfaces / types only. No LLM, API, or runtime execution.
 */

export type OrchestratorLocale = 'ar' | 'en'

/** UI modules the orchestrator may coordinate (presentation architecture). */
export type OrchestratorModuleId =
  | 'application_shell'
  | 'conversation_center'
  | 'voice_center'
  | 'travel_workspace'
  | 'executive_dashboard'
  | 'command_palette'
  | 'journey_timeline'
  | 'decision_center'
  | 'insights_center'
  | 'traveler_profile'
  | 'memory_center'
  | 'booking_hub'
  | 'operations_center'
  | 'integration_foundation'

export type ConversationIntentKind =
  | 'discover'
  | 'plan'
  | 'compare'
  | 'book'
  | 'clarify'
  | 'status'
  | 'memory_update'
  | 'general'

export type ConversationStateId =
  | 'idle'
  | 'listening'
  | 'understanding'
  | 'clarifying'
  | 'planning'
  | 'deciding'
  | 'responding'
  | 'awaiting_user'
  | 'closed'

export type ConversationEventKind =
  | 'session_started'
  | 'turn_received'
  | 'intent_detected'
  | 'context_built'
  | 'memory_read'
  | 'memory_written'
  | 'clarification_needed'
  | 'question_generated'
  | 'confidence_scored'
  | 'response_planned'
  | 'task_enqueued'
  | 'planning_enqueued'
  | 'state_transition'
  | 'session_ended'

export type ConfidenceBand = 'low' | 'medium' | 'high'

export interface ConversationTurnContract {
  turnId: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  text: string
  locale: OrchestratorLocale
  createdAtIso: string
}

export interface IntentPipelineContract {
  kind: 'intent_pipeline'
  inputTurnId: string
  detectedIntent: ConversationIntentKind
  secondaryIntents: ConversationIntentKind[]
  signals: string[]
  /** Architecture only — never invokes an LLM. */
  execution: 'none'
}

export interface ContextSliceContract {
  moduleId: OrchestratorModuleId
  summary: string
  facts: readonly string[]
}

export interface ContextBuilderContract {
  kind: 'context_builder'
  sessionId: string
  slices: ContextSliceContract[]
  execution: 'none'
}

export interface MemoryReaderContract {
  kind: 'memory_reader'
  sessionId: string
  keysRequested: readonly string[]
  /** Placeholder read model — no database. */
  entries: readonly { key: string; value: string }[]
  execution: 'none'
}

export interface MemoryWriterContract {
  kind: 'memory_writer'
  sessionId: string
  proposedWrites: readonly { key: string; value: string }[]
  /** Never persists — architecture only. */
  persisted: false
  execution: 'none'
}

export interface PlanningContextContract {
  kind: 'planning_context'
  destinationHints: readonly string[]
  dateHints: readonly string[]
  budgetHints: readonly string[]
  moduleTargets: readonly OrchestratorModuleId[]
}

export interface DecisionContextContract {
  kind: 'decision_context'
  alternatives: readonly string[]
  criteria: readonly string[]
  moduleTargets: readonly OrchestratorModuleId[]
}

export interface TravelerContextContract {
  kind: 'traveler_context'
  travelerIds: readonly string[]
  preferences: readonly string[]
  moduleTargets: readonly OrchestratorModuleId[]
}

export interface BookingContextContract {
  kind: 'booking_context'
  bookingRefs: readonly string[]
  statuses: readonly string[]
  moduleTargets: readonly OrchestratorModuleId[]
}

export interface WorkspaceContextContract {
  kind: 'workspace_context'
  activePanels: readonly string[]
  moduleTargets: readonly OrchestratorModuleId[]
}

export interface ConversationSessionContract {
  kind: 'conversation_session'
  sessionId: string
  locale: OrchestratorLocale
  openedAtIso: string
  stateId: ConversationStateId
  moduleIds: readonly OrchestratorModuleId[]
}

export interface ConversationTimelineEntry {
  id: string
  atIso: string
  label: string
  relatedTurnId?: string
}

export interface ConversationTimelineContract {
  kind: 'conversation_timeline'
  sessionId: string
  entries: readonly ConversationTimelineEntry[]
}

export interface StateTransitionContract {
  from: ConversationStateId
  to: ConversationStateId
  reason: string
}

export interface ConversationStateMachineContract {
  kind: 'conversation_state_machine'
  current: ConversationStateId
  allowed: readonly ConversationStateId[]
  lastTransition: StateTransitionContract | null
  execution: 'none'
}

export interface ResponsePipelineContract {
  kind: 'response_pipeline'
  stages: readonly (
    | 'compose_outline'
    | 'attach_modules'
    | 'attach_confidence'
    | 'finalize_contract'
  )[]
  outline: string
  moduleHints: readonly OrchestratorModuleId[]
  execution: 'none'
}

export interface ClarificationEngineContract {
  kind: 'clarification_engine'
  needed: boolean
  missingSlots: readonly string[]
  execution: 'none'
}

export interface QuestionGeneratorContract {
  kind: 'question_generator'
  questions: readonly string[]
  execution: 'none'
}

export interface ConfidenceEngineContract {
  kind: 'confidence_engine'
  score: number
  band: ConfidenceBand
  rationale: readonly string[]
  execution: 'none'
}

export interface ReasoningPipelineContract {
  kind: 'reasoning_pipeline'
  steps: readonly {
    id: string
    label: string
    inputRefs: readonly string[]
    outputRef: string
  }[]
  /** Never runs model inference. */
  execution: 'none'
}

export interface QueueItemContract {
  id: string
  label: string
  priority: 'low' | 'medium' | 'high'
  moduleId?: OrchestratorModuleId
}

export interface TaskQueueContract {
  kind: 'task_queue'
  items: readonly QueueItemContract[]
  execution: 'none'
}

export interface PlanningQueueContract {
  kind: 'planning_queue'
  items: readonly QueueItemContract[]
  execution: 'none'
}

export interface ConversationEventContract {
  kind: 'conversation_event'
  eventId: string
  eventKind: ConversationEventKind
  sessionId: string
  atIso: string
  payloadSummary: string
}

export interface ConversationAnalyticsContract {
  kind: 'conversation_analytics'
  sessionId: string
  turnCount: number
  clarificationCount: number
  averageConfidence: number
  /** Metrics shape only — no telemetry backend. */
  exported: false
}

export interface ConversationOrchestrationBlueprint {
  version: '6.2.0-conversation-orchestrator'
  featureId: 'brain.conversation_orchestrator'
  presentationArchitectureOnly: true
  session: ConversationSessionContract
  intent: IntentPipelineContract
  context: ContextBuilderContract
  memoryRead: MemoryReaderContract
  memoryWrite: MemoryWriterContract
  planningContext: PlanningContextContract
  decisionContext: DecisionContextContract
  travelerContext: TravelerContextContract
  bookingContext: BookingContextContract
  workspaceContext: WorkspaceContextContract
  timeline: ConversationTimelineContract
  stateMachine: ConversationStateMachineContract
  response: ResponsePipelineContract
  clarification: ClarificationEngineContract
  questions: QuestionGeneratorContract
  confidence: ConfidenceEngineContract
  reasoning: ReasoningPipelineContract
  taskQueue: TaskQueueContract
  planningQueue: PlanningQueueContract
  events: readonly ConversationEventContract[]
  analytics: ConversationAnalyticsContract
  coordinatedModules: readonly OrchestratorModuleId[]
}

export const CONVERSATION_ORCHESTRATOR_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoOpenAi: false,
  wiredIntoClaude: false,
  wiredIntoGemini: false,
  wiredIntoAzure: false,
  wiredIntoVertex: false,
  wiredIntoFirebase: false,
  wiredIntoSupabase: false,
  wiredIntoRealtime: false,
  wiredIntoDatabase: false,
  wiredIntoAuthentication: false,
  wiredIntoPayments: false,
  wiredIntoMaps: false,
  wiredIntoWeather: false,
  wiredIntoBookingApis: false,
  wiredIntoAmadeus: false,
  llmExecution: false,
  apiImplementation: false,
  runtimeExecution: false,
} as const

export const ORCHESTRATOR_MODULE_IDS: readonly OrchestratorModuleId[] = [
  'application_shell',
  'conversation_center',
  'voice_center',
  'travel_workspace',
  'executive_dashboard',
  'command_palette',
  'journey_timeline',
  'decision_center',
  'insights_center',
  'traveler_profile',
  'memory_center',
  'booking_hub',
  'operations_center',
  'integration_foundation',
] as const

export const CONVERSATION_STATE_IDS: readonly ConversationStateId[] = [
  'idle',
  'listening',
  'understanding',
  'clarifying',
  'planning',
  'deciding',
  'responding',
  'awaiting_user',
  'closed',
] as const
