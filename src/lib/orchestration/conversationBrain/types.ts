/**
 * Phase 7 Stage 12 — AI Conversation Brain Orchestrator contracts.
 * Architecture / interfaces / types / blueprints only.
 * Coordinates Phase 7 engines through contracts only — no runtime execution.
 * Distinct from src/lib/agent/conversationBrain and brain.conversation_orchestrator.
 */

export type ConversationBrainLocale = 'ar' | 'en'

export type ConversationBrainSectionId =
  | 'conversation_brain_engine'
  | 'conversation_brain_pipeline'
  | 'conversation_brain_schema'
  | 'conversation_brain_strategy'
  | 'conversation_brain_validation'
  | 'conversation_brain_lifecycle'
  | 'conversation_brain_snapshot'
  | 'conversation_brain_revision'

/** Coordinated engine contract hints (architecture references only). */
export type ConversationBrainEngineHint =
  | 'personalization_engine'
  | 'preference_extraction_engine'
  | 'traveler_context_engine'
  | 'intent_recognition_engine'
  | 'travel_planning_engine'
  | 'travel_search_orchestrator'
  | 'travel_recommendation_engine'
  | 'offer_decision_engine'
  | 'booking_orchestrator'

/** Output contracts */
export interface ConversationBrainRequest {
  kind: 'phase7_conversation_brain_request'
  requestId: string
  messageHint: string
  localeHint: ConversationBrainLocale
  execution: 'none'
}

export interface ConversationBrainState {
  kind: 'phase7_conversation_brain_state'
  stateId: string
  requestId: string
  currentStepHint: string | null
  engineHints: readonly ConversationBrainEngineHint[]
  execution: 'none'
}

export interface ConversationBrainStep {
  kind: 'phase7_conversation_brain_step'
  stepId: string
  requestId: string
  engineHint: ConversationBrainEngineHint
  statusHint: 'pending' | 'ready' | 'skipped'
  execution: 'none'
}

export interface ConversationBrainDecision {
  kind: 'phase7_conversation_brain_decision'
  decisionId: string
  requestId: string
  decisionHint: string
  execution: 'none'
}

export interface ConversationBrainResult {
  kind: 'phase7_conversation_brain_result'
  resultId: string
  requestId: string
  summaryHint: string
  /** Distinct from agent/conversationBrain ConversationBrainResult shape. */
  architectureOnly: true
  execution: 'none'
}

export interface ConversationBrainConfidence {
  kind: 'phase7_conversation_brain_confidence'
  requestId: string
  scoreHint: number
  bandHint: 'low' | 'medium' | 'high'
  execution: 'none'
}

export interface ConversationBrainValidation {
  kind: 'phase7_conversation_brain_validation'
  requestId: string
  valid: boolean
  issues: readonly string[]
  execution: 'none'
}

export interface ConversationBrainSnapshot {
  kind: 'phase7_conversation_brain_snapshot'
  snapshotId: string
  atIso: string
  requestId: string | null
  execution: 'none'
}

export interface ConversationBrainRevision {
  kind: 'phase7_conversation_brain_revision'
  revisionId: string
  requestId: string
  reasonHint: string
  execution: 'none'
}

export interface ConversationBrainEngineContract {
  kind: 'phase7_conversation_brain_engine'
  version: '7.12.0-conversation-brain'
  execution: 'none'
  books: false
  providerCalled: false
  llmInvoked: false
  httpRequests: false
}

export interface ConversationBrainPipelineContract {
  kind: 'phase7_conversation_brain_pipeline'
  stages: readonly string[]
  execution: 'none'
}

export interface ConversationBrainSchemaContract {
  kind: 'phase7_conversation_brain_schema'
  outputKinds: readonly string[]
  execution: 'none'
}

export interface ConversationBrainStrategyContract {
  kind: 'phase7_conversation_brain_strategy'
  strategyHints: readonly string[]
  execution: 'none'
}

export interface ConversationBrainValidationContract {
  kind: 'phase7_conversation_brain_validation_contract'
  validation: ConversationBrainValidation
  execution: 'none'
}

export interface ConversationBrainLifecycleContract {
  kind: 'phase7_conversation_brain_lifecycle'
  actions: readonly string[]
  currentActionHint: string | null
  execution: 'none'
}

export interface ConversationBrainSnapshotContract {
  kind: 'phase7_conversation_brain_snapshot_contract'
  snapshot: ConversationBrainSnapshot
  execution: 'none'
}

export interface ConversationBrainRevisionContract {
  kind: 'phase7_conversation_brain_revision_contract'
  revisions: readonly ConversationBrainRevision[]
  persisted: false
  execution: 'none'
}

export interface ConversationBrainRegistryEntry {
  id: string
  sectionId: ConversationBrainSectionId
  label: string
  enabledHint: false
}

export interface ConversationBrainBlueprint {
  version: '7.12.0-conversation-brain'
  featureId: 'brain.conversation_brain'
  architectureOnly: true
  engine: ConversationBrainEngineContract
  pipeline: ConversationBrainPipelineContract
  schema: ConversationBrainSchemaContract
  strategy: ConversationBrainStrategyContract
  validation: ConversationBrainValidationContract
  lifecycle: ConversationBrainLifecycleContract
  snapshot: ConversationBrainSnapshotContract
  revision: ConversationBrainRevisionContract
  /** Output contract samples */
  conversationBrainRequest: ConversationBrainRequest
  conversationBrainState: ConversationBrainState
  conversationBrainStep: ConversationBrainStep
  conversationBrainDecision: ConversationBrainDecision
  conversationBrainResult: ConversationBrainResult
  conversationBrainConfidence: ConversationBrainConfidence
  conversationBrainValidation: ConversationBrainValidation
  conversationBrainSnapshot: ConversationBrainSnapshot
  conversationBrainRevision: ConversationBrainRevision
  registry: readonly ConversationBrainRegistryEntry[]
  coordinatedEngineHints: readonly ConversationBrainEngineHint[]
}

export const CONVERSATION_BRAIN_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoRuntime: false,
  wiredIntoLlms: false,
  wiredIntoProviderApis: false,
  bookingExecuted: false,
  httpRequests: false,
  wiredIntoDatabase: false,
  wiredIntoStorage: false,
  wiredIntoUi: false,
  businessLogicExecuted: false,
  enginesInvoked: false,
  distinctFromAgentConversationBrain: true,
  distinctFromBrainConversationOrchestrator: true,
  distinctFromAiConversationOrchestrator: true,
  distinctFromBookingOrchestrator: true,
} as const

export const CONVERSATION_BRAIN_SECTION_IDS: readonly ConversationBrainSectionId[] =
  [
    'conversation_brain_engine',
    'conversation_brain_pipeline',
    'conversation_brain_schema',
    'conversation_brain_strategy',
    'conversation_brain_validation',
    'conversation_brain_lifecycle',
    'conversation_brain_snapshot',
    'conversation_brain_revision',
  ] as const

/** Pipeline: User Message → … → Booking Draft → ConversationBrainResult */
export const CONVERSATION_BRAIN_PIPELINE_STAGES = [
  'receive_user_message',
  'personalization',
  'preference_extraction',
  'traveler_context',
  'intent_recognition',
  'travel_planning',
  'travel_search',
  'recommendation',
  'offer_decision',
  'booking_draft',
  'emit_conversation_brain_result',
] as const

export type ConversationBrainPipelineStageId =
  (typeof CONVERSATION_BRAIN_PIPELINE_STAGES)[number]

export const CONVERSATION_BRAIN_LIFECYCLE_ACTIONS = [
  'receive',
  'advance',
  'decide',
  'validate',
  'snapshot',
  'revise',
  'close',
] as const

export const CONVERSATION_BRAIN_ENGINE_HINTS: readonly ConversationBrainEngineHint[] =
  [
    'personalization_engine',
    'preference_extraction_engine',
    'traveler_context_engine',
    'intent_recognition_engine',
    'travel_planning_engine',
    'travel_search_orchestrator',
    'travel_recommendation_engine',
    'offer_decision_engine',
    'booking_orchestrator',
  ] as const

export const CONVERSATION_BRAIN_STRATEGY_HINTS = [
  'contract_coordination_only',
  'never_execute_engines',
  'never_call_providers',
  'never_invoke_llm',
  'preserve_engine_boundaries',
] as const
