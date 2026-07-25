/**
 * Phase 7 Stage 5 — Traveler Context Engine contracts.
 * Architecture / interfaces / types / blueprints only.
 * Live conversation context (not Memory). No LLM, Runtime, DB, HTTP, or APIs.
 */

export type ContextLocale = 'ar' | 'en'

export type ContextTimelineEventKind =
  | 'engine_opened'
  | 'session_attached'
  | 'conversation_snapshotted'
  | 'trip_context_hinted'
  | 'constraints_merged'
  | 'context_validated'
  | 'context_freshened'
  | 'audit_appended'

export type ContextSectionId =
  | 'context_engine'
  | 'conversation_context'
  | 'travel_context'
  | 'current_trip_context'
  | 'traveler_state'
  | 'session_context'
  | 'environment_context'
  | 'constraint_context'
  | 'budget_context'
  | 'destination_context'
  | 'timeline_context'
  | 'companion_context'
  | 'weather_context'
  | 'transportation_context'
  | 'accommodation_context'
  | 'activity_context'
  | 'visa_context'
  | 'current_goal_context'
  | 'conversation_snapshot'
  | 'context_confidence'
  | 'context_freshness'
  | 'context_merge_rules'
  | 'context_priorities'
  | 'context_validation'

/** Output contracts */
export interface TravelerContext {
  kind: 'traveler_context'
  travelerIdHint: string
  stateHints: readonly string[]
  execution: 'none'
}

export interface ConversationContext {
  kind: 'conversation_context'
  conversationId: string
  intentHint: string | null
  goalHints: readonly string[]
  execution: 'none'
}

export interface TripContext {
  kind: 'trip_context'
  tripIdHint: string | null
  destinationHints: readonly string[]
  execution: 'none'
}

export interface SessionContext {
  kind: 'session_context'
  sessionId: string
  locale: ContextLocale
  execution: 'none'
}

export interface ContextSnapshot {
  kind: 'context_snapshot'
  snapshotId: string
  atIso: string
  sectionHints: readonly ContextSectionId[]
  execution: 'none'
}

export interface ContextConfidence {
  kind: 'context_confidence'
  scoreHint: number
  bandHint: 'low' | 'medium' | 'high'
  execution: 'none'
}

export interface ContextValidation {
  kind: 'context_validation'
  valid: boolean
  issues: readonly string[]
  execution: 'none'
}

export interface ContextEngineContract {
  kind: 'context_engine'
  version: '7.5.0-traveler-context'
  execution: 'none'
  distinctFromMemory: true
}

export interface ConversationContextContract {
  kind: 'conversation_context_contract'
  conversation: ConversationContext
  execution: 'none'
}

export interface TravelContextContract {
  kind: 'travel_context'
  facets: readonly string[]
  execution: 'none'
}

export interface CurrentTripContextContract {
  kind: 'current_trip_context'
  trip: TripContext
  execution: 'none'
}

export interface TravelerStateContract {
  kind: 'traveler_state'
  traveler: TravelerContext
  execution: 'none'
}

export interface SessionContextContract {
  kind: 'session_context_contract'
  session: SessionContext
  execution: 'none'
}

export interface EnvironmentContextContract {
  kind: 'environment_context'
  timeHint: string
  locationHint: string | null
  execution: 'none'
}

export interface ConstraintContextContract {
  kind: 'constraint_context'
  constraintHints: readonly string[]
  execution: 'none'
}

export interface BudgetContextContract {
  kind: 'budget_context'
  currencyHint: string
  amountHint: number | null
  execution: 'none'
}

export interface DestinationContextContract {
  kind: 'destination_context'
  destinationHints: readonly string[]
  execution: 'none'
}

export interface TimelineContextContract {
  kind: 'timeline_context'
  dateHints: readonly string[]
  execution: 'none'
}

export interface CompanionContextContract {
  kind: 'companion_context'
  companionHints: readonly string[]
  execution: 'none'
}

export interface WeatherContextContract {
  kind: 'weather_context'
  weatherHints: readonly string[]
  execution: 'none'
}

export interface TransportationContextContract {
  kind: 'transportation_context'
  modeHints: readonly string[]
  execution: 'none'
}

export interface AccommodationContextContract {
  kind: 'accommodation_context'
  lodgingHints: readonly string[]
  execution: 'none'
}

export interface ActivityContextContract {
  kind: 'activity_context'
  activityHints: readonly string[]
  execution: 'none'
}

export interface VisaContextContract {
  kind: 'visa_context'
  documentHints: readonly string[]
  execution: 'none'
}

export interface CurrentGoalContextContract {
  kind: 'current_goal_context'
  goalHints: readonly string[]
  execution: 'none'
}

export interface ConversationSnapshotContract {
  kind: 'conversation_snapshot'
  snapshot: ContextSnapshot
  execution: 'none'
}

export interface ContextConfidenceContract {
  kind: 'context_confidence_contract'
  confidence: ContextConfidence
  execution: 'none'
}

export interface ContextFreshnessContract {
  kind: 'context_freshness'
  freshnessBandHint: 'fresh' | 'stale' | 'unknown'
  execution: 'none'
}

export interface ContextMergeRulesContract {
  kind: 'context_merge_rules'
  ruleHints: readonly string[]
  execution: 'none'
}

export interface ContextPrioritiesContract {
  kind: 'context_priorities'
  priorityHints: readonly string[]
  execution: 'none'
}

export interface ContextValidationContract {
  kind: 'context_validation_contract'
  validation: ContextValidation
  execution: 'none'
}

export interface ContextRegistryEntry {
  id: string
  sectionId: ContextSectionId
  label: string
  enabledHint: false
}

export interface TravelerContextEngineBlueprint {
  version: '7.5.0-traveler-context'
  featureId: 'brain.context_engine'
  architectureOnly: true
  engine: ContextEngineContract
  conversationContext: ConversationContextContract
  travelContext: TravelContextContract
  currentTripContext: CurrentTripContextContract
  travelerState: TravelerStateContract
  sessionContext: SessionContextContract
  environmentContext: EnvironmentContextContract
  constraintContext: ConstraintContextContract
  budgetContext: BudgetContextContract
  destinationContext: DestinationContextContract
  timelineContext: TimelineContextContract
  companionContext: CompanionContextContract
  weatherContext: WeatherContextContract
  transportationContext: TransportationContextContract
  accommodationContext: AccommodationContextContract
  activityContext: ActivityContextContract
  visaContext: VisaContextContract
  currentGoalContext: CurrentGoalContextContract
  conversationSnapshot: ConversationSnapshotContract
  contextConfidence: ContextConfidenceContract
  contextFreshness: ContextFreshnessContract
  contextMergeRules: ContextMergeRulesContract
  contextPriorities: ContextPrioritiesContract
  contextValidation: ContextValidationContract
  /** Output contract samples */
  travelerContext: TravelerContext
  conversation: ConversationContext
  trip: TripContext
  session: SessionContext
  snapshot: ContextSnapshot
  confidence: ContextConfidence
  validation: ContextValidation
  registry: readonly ContextRegistryEntry[]
}

export const TRAVELER_CONTEXT_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoLlms: false,
  wiredIntoRuntime: false,
  wiredIntoDatabase: false,
  wiredIntoStorage: false,
  httpRequests: false,
  wiredIntoApis: false,
  businessLogic: false,
  distinctFromMemoryEngine: true,
  distinctFromContextMemory: true,
} as const

export const CONTEXT_SECTION_IDS: readonly ContextSectionId[] = [
  'context_engine',
  'conversation_context',
  'travel_context',
  'current_trip_context',
  'traveler_state',
  'session_context',
  'environment_context',
  'constraint_context',
  'budget_context',
  'destination_context',
  'timeline_context',
  'companion_context',
  'weather_context',
  'transportation_context',
  'accommodation_context',
  'activity_context',
  'visa_context',
  'current_goal_context',
  'conversation_snapshot',
  'context_confidence',
  'context_freshness',
  'context_merge_rules',
  'context_priorities',
  'context_validation',
] as const

export const CONTEXT_PIPELINE_STAGES = [
  'attach_session',
  'load_conversation_state',
  'resolve_current_intent',
  'resolve_current_goals',
  'attach_traveler_preferences',
  'attach_constraints',
  'attach_environment',
  'attach_time_location',
  'attach_budget',
  'attach_documents',
  'build_trip_context',
  'merge_contexts',
  'apply_priorities',
  'score_confidence',
  'check_freshness',
  'validate',
  'emit_snapshot',
] as const

export type ContextPipelineStageId = (typeof CONTEXT_PIPELINE_STAGES)[number]

export const CONTEXT_LIFECYCLE_ACTIONS = [
  'open',
  'refresh',
  'merge',
  'validate',
  'snapshot',
  'close',
] as const

export type ContextLifecycleAction = (typeof CONTEXT_LIFECYCLE_ACTIONS)[number]
