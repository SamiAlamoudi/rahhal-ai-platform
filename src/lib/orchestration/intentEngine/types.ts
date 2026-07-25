/**
 * Phase 7 Stage 6 — Intent Recognition Engine contracts.
 * Architecture / interfaces / types / blueprints only.
 * No LLM, Runtime, DB, storage, HTTP, or APIs.
 */

export type IntentLocale = 'ar' | 'en'

export type IntentKindId =
  | 'book_flight'
  | 'book_hotel'
  | 'plan_trip'
  | 'modify_trip'
  | 'cancel_trip'
  | 'compare_destinations'
  | 'ask_question'
  | 'visa_inquiry'
  | 'budget_advice'
  | 'transportation'
  | 'restaurant_recommendation'
  | 'activity_search'
  | 'emergency_support'
  | 'customer_service'
  | 'general_conversation'
  | 'multi_intent'
  | 'intent_switching'

export type IntentDomainId =
  | 'conversation'
  | 'travel'
  | 'booking'
  | 'support'
  | 'general'

export type IntentSectionId =
  | 'intent_engine'
  | 'intent_registry'
  | 'intent_classifier'
  | 'intent_schema'
  | 'intent_confidence'
  | 'intent_validation'
  | 'intent_priority_rules'
  | 'intent_resolution_rules'
  | 'intent_transition_model'
  | 'conversation_intent'
  | 'travel_intent'
  | 'booking_intent'
  | 'support_intent'
  | 'multi_intent'
  | 'intent_history'
  | 'intent_snapshot'

/** Output contracts */
export interface TravelerIntent {
  kind: 'traveler_intent'
  intentId: string
  intentKind: IntentKindId
  domainHint: IntentDomainId
  execution: 'none'
}

export interface IntentPrediction {
  kind: 'intent_prediction'
  predictionId: string
  intentKind: IntentKindId
  rankHint: number
  execution: 'none'
}

export interface IntentConfidence {
  kind: 'intent_confidence'
  intentId: string
  scoreHint: number
  bandHint: 'low' | 'medium' | 'high'
  execution: 'none'
}

export interface IntentTransition {
  kind: 'intent_transition'
  fromIntent: IntentKindId | null
  toIntent: IntentKindId | null
  reasonHint: string
  execution: 'none'
}

export interface IntentValidation {
  kind: 'intent_validation'
  intentId: string
  valid: boolean
  issues: readonly string[]
  execution: 'none'
}

export interface MultiIntentResult {
  kind: 'multi_intent_result'
  resultId: string
  intents: readonly IntentKindId[]
  primaryHint: IntentKindId | null
  execution: 'none'
}

export interface IntentEngineContract {
  kind: 'intent_engine'
  version: '7.6.0-intent-engine'
  execution: 'none'
}

export interface IntentRegistryEntry {
  id: string
  intentKind: IntentKindId
  domainHint: IntentDomainId
  label: string
  enabledHint: false
}

export interface IntentRegistryContract {
  kind: 'intent_registry'
  entries: readonly IntentRegistryEntry[]
  execution: 'none'
}

export interface IntentClassifierContract {
  kind: 'intent_classifier'
  classifierHint: string
  execution: 'none'
}

export interface IntentSchemaContract {
  kind: 'intent_schema'
  intentKinds: readonly IntentKindId[]
  domains: readonly IntentDomainId[]
  execution: 'none'
}

export interface IntentConfidenceContract {
  kind: 'intent_confidence_contract'
  confidence: IntentConfidence
  execution: 'none'
}

export interface IntentValidationContract {
  kind: 'intent_validation_contract'
  validation: IntentValidation
  execution: 'none'
}

export interface IntentPriorityRulesContract {
  kind: 'intent_priority_rules'
  ruleHints: readonly string[]
  execution: 'none'
}

export interface IntentResolutionRulesContract {
  kind: 'intent_resolution_rules'
  ruleHints: readonly string[]
  execution: 'none'
}

export interface IntentTransitionModelContract {
  kind: 'intent_transition_model'
  allowedTransitions: readonly IntentTransition[]
  execution: 'none'
}

export interface ConversationIntentContract {
  kind: 'conversation_intent'
  intentKinds: readonly IntentKindId[]
  execution: 'none'
}

export interface TravelIntentContract {
  kind: 'travel_intent'
  intentKinds: readonly IntentKindId[]
  execution: 'none'
}

export interface BookingIntentContract {
  kind: 'booking_intent'
  intentKinds: readonly IntentKindId[]
  execution: 'none'
}

export interface SupportIntentContract {
  kind: 'support_intent'
  intentKinds: readonly IntentKindId[]
  execution: 'none'
}

export interface MultiIntentContract {
  kind: 'multi_intent'
  result: MultiIntentResult
  execution: 'none'
}

export interface IntentHistoryEntry {
  id: string
  intentKind: IntentKindId
  atIso: string
  summary: string
}

export interface IntentHistoryContract {
  kind: 'intent_history'
  entries: readonly IntentHistoryEntry[]
  persisted: false
  execution: 'none'
}

export interface IntentSnapshotContract {
  kind: 'intent_snapshot'
  snapshotId: string
  atIso: string
  primaryIntent: IntentKindId | null
  predictions: readonly IntentPrediction[]
  execution: 'none'
}

export interface IntentSectionRegistryEntry {
  id: string
  sectionId: IntentSectionId
  label: string
  enabledHint: false
}

export interface IntentEngineBlueprint {
  version: '7.6.0-intent-engine'
  featureId: 'brain.intent_engine'
  architectureOnly: true
  engine: IntentEngineContract
  registry: IntentRegistryContract
  classifier: IntentClassifierContract
  schema: IntentSchemaContract
  confidence: IntentConfidenceContract
  validation: IntentValidationContract
  priorityRules: IntentPriorityRulesContract
  resolutionRules: IntentResolutionRulesContract
  transitionModel: IntentTransitionModelContract
  conversationIntent: ConversationIntentContract
  travelIntent: TravelIntentContract
  bookingIntent: BookingIntentContract
  supportIntent: SupportIntentContract
  multiIntent: MultiIntentContract
  history: IntentHistoryContract
  snapshot: IntentSnapshotContract
  /** Output contract samples */
  travelerIntent: TravelerIntent
  intentPrediction: IntentPrediction
  intentConfidence: IntentConfidence
  intentTransition: IntentTransition
  intentValidation: IntentValidation
  multiIntentResult: MultiIntentResult
  sectionRegistry: readonly IntentSectionRegistryEntry[]
}

export const INTENT_ENGINE_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoLlms: false,
  wiredIntoRuntime: false,
  wiredIntoDatabase: false,
  wiredIntoStorage: false,
  httpRequests: false,
  wiredIntoApis: false,
  businessLogic: false,
  distinctFromSprint19BrainIntent: true,
} as const

export const INTENT_KINDS: readonly IntentKindId[] = [
  'book_flight',
  'book_hotel',
  'plan_trip',
  'modify_trip',
  'cancel_trip',
  'compare_destinations',
  'ask_question',
  'visa_inquiry',
  'budget_advice',
  'transportation',
  'restaurant_recommendation',
  'activity_search',
  'emergency_support',
  'customer_service',
  'general_conversation',
  'multi_intent',
  'intent_switching',
] as const

export const INTENT_DOMAINS: readonly IntentDomainId[] = [
  'conversation',
  'travel',
  'booking',
  'support',
  'general',
] as const

export const INTENT_SECTION_IDS: readonly IntentSectionId[] = [
  'intent_engine',
  'intent_registry',
  'intent_classifier',
  'intent_schema',
  'intent_confidence',
  'intent_validation',
  'intent_priority_rules',
  'intent_resolution_rules',
  'intent_transition_model',
  'conversation_intent',
  'travel_intent',
  'booking_intent',
  'support_intent',
  'multi_intent',
  'intent_history',
  'intent_snapshot',
] as const

export const INTENT_PIPELINE_STAGES = [
  'attach_conversation',
  'classify_candidates',
  'score_confidence',
  'validate',
  'apply_priorities',
  'resolve_primary',
  'detect_multi_intent',
  'model_transition',
  'append_history',
  'emit_snapshot',
] as const

export type IntentPipelineStageId = (typeof INTENT_PIPELINE_STAGES)[number]

export function domainForIntent(intentKind: IntentKindId): IntentDomainId {
  switch (intentKind) {
    case 'book_flight':
    case 'book_hotel':
    case 'modify_trip':
    case 'cancel_trip':
      return 'booking'
    case 'plan_trip':
    case 'compare_destinations':
    case 'visa_inquiry':
    case 'budget_advice':
    case 'transportation':
    case 'restaurant_recommendation':
    case 'activity_search':
      return 'travel'
    case 'emergency_support':
    case 'customer_service':
      return 'support'
    case 'ask_question':
    case 'general_conversation':
    case 'multi_intent':
    case 'intent_switching':
      return 'conversation'
    default:
      return 'general'
  }
}
