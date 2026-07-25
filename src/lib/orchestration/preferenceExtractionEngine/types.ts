/**
 * Phase 7 Stage 4 — AI Smart Preference Extraction Engine contracts.
 * Architecture / interfaces / types / blueprints only.
 * No LLM, DB, storage, Runtime, recommendation execution, HTTP, or APIs.
 */

export type PreferenceExtractionLocale = 'ar' | 'en'

export type PreferenceCategoryId =
  | 'destination'
  | 'accommodation'
  | 'transportation'
  | 'budget'
  | 'food'
  | 'activity'
  | 'language'
  | 'accessibility'
  | 'weather'
  | 'travel_style'

export type PreferenceSourceKind =
  | 'explicit_utterance'
  | 'implicit_signal'
  | 'conversation_history'
  | 'revision'
  | 'merge'
  | 'architecture_placeholder'

export type PreferenceTimelineEventKind =
  | 'engine_opened'
  | 'preference_detected'
  | 'preference_validated'
  | 'preference_merged'
  | 'conflict_resolved'
  | 'confidence_scored'
  | 'preference_expired_hint'
  | 'revision_recorded'
  | 'audit_appended'

export type PreferenceExtractionSectionId =
  | 'preference_extraction_engine'
  | 'conversation_preference_parser'
  | 'implicit_preference_detector'
  | 'explicit_preference_detector'
  | 'preference_confidence_model'
  | 'preference_conflict_resolver'
  | 'preference_freshness_model'
  | 'preference_timeline'
  | 'preference_revision_history'
  | 'preference_sources'
  | 'preference_merge_strategy'
  | 'preference_validation_rules'
  | 'preference_confidence_score'
  | 'preference_weighting'
  | 'preference_expiration'
  | 'preference_categories'
  | 'destination_preferences'
  | 'accommodation_preferences'
  | 'transportation_preferences'
  | 'budget_preferences'
  | 'food_preferences'
  | 'activity_preferences'
  | 'language_preferences'
  | 'accessibility_preferences'
  | 'weather_preferences'
  | 'travel_style_preferences'

/** Output contracts */
export interface ExtractedPreference {
  kind: 'extracted_preference'
  preferenceId: string
  categoryId: PreferenceCategoryId
  valueHint: string
  sourceKind: PreferenceSourceKind
  execution: 'none'
}

export interface PreferenceCandidate {
  kind: 'preference_candidate'
  candidateId: string
  categoryId: PreferenceCategoryId
  rawHint: string
  detectorHint: 'implicit' | 'explicit' | 'parser'
  execution: 'none'
}

export interface PreferenceEvidence {
  kind: 'preference_evidence'
  evidenceId: string
  candidateId: string
  utteranceHint: string
  strengthHint: 'weak' | 'medium' | 'strong'
  execution: 'none'
}

export interface PreferenceConfidence {
  kind: 'preference_confidence'
  preferenceId: string
  scoreHint: number
  bandHint: 'low' | 'medium' | 'high'
  execution: 'none'
}

export interface PreferenceValidation {
  kind: 'preference_validation'
  preferenceId: string
  valid: boolean
  issues: readonly string[]
  execution: 'none'
}

export interface PreferenceUpdate {
  kind: 'preference_update'
  updateId: string
  preferenceId: string
  actionHint: 'create' | 'revise' | 'merge' | 'expire'
  execution: 'none'
}

export interface PreferenceExtractionEngineContract {
  kind: 'preference_extraction_engine'
  version: '7.4.0-preference-extraction'
  execution: 'none'
}

export interface ConversationPreferenceParserContract {
  kind: 'conversation_preference_parser'
  parseModeHint: 'architecture_placeholder'
  execution: 'none'
}

export interface ImplicitPreferenceDetectorContract {
  kind: 'implicit_preference_detector'
  signalHints: readonly string[]
  execution: 'none'
}

export interface ExplicitPreferenceDetectorContract {
  kind: 'explicit_preference_detector'
  utteranceHints: readonly string[]
  execution: 'none'
}

export interface PreferenceConfidenceModelContract {
  kind: 'preference_confidence_model'
  modelHint: string
  execution: 'none'
}

export interface PreferenceConflictResolverContract {
  kind: 'preference_conflict_resolver'
  strategyHints: readonly string[]
  execution: 'none'
}

export interface PreferenceFreshnessModelContract {
  kind: 'preference_freshness_model'
  freshnessBandHint: 'fresh' | 'stale' | 'unknown'
  execution: 'none'
}

export interface PreferenceTimelineEvent {
  eventId: string
  eventKind: PreferenceTimelineEventKind
  atIso: string
  summary: string
}

export interface PreferenceTimelineContract {
  kind: 'preference_timeline'
  events: readonly PreferenceTimelineEvent[]
  execution: 'none'
}

export interface PreferenceRevisionEntry {
  revisionId: string
  preferenceId: string
  atIso: string
  reasonHint: string
}

export interface PreferenceRevisionHistoryContract {
  kind: 'preference_revision_history'
  revisions: readonly PreferenceRevisionEntry[]
  persisted: false
  execution: 'none'
}

export interface PreferenceSourcesContract {
  kind: 'preference_sources'
  sources: readonly PreferenceSourceKind[]
  execution: 'none'
}

export interface PreferenceMergeStrategyContract {
  kind: 'preference_merge_strategy'
  strategyHints: readonly string[]
  execution: 'none'
}

export interface PreferenceValidationRulesContract {
  kind: 'preference_validation_rules'
  ruleIds: readonly string[]
  execution: 'none'
}

export interface PreferenceConfidenceScoreContract {
  kind: 'preference_confidence_score'
  scores: readonly PreferenceConfidence[]
  execution: 'none'
}

export interface PreferenceWeightingContract {
  kind: 'preference_weighting'
  weightHints: readonly { categoryId: PreferenceCategoryId; weightHint: number }[]
  execution: 'none'
}

export interface PreferenceExpirationContract {
  kind: 'preference_expiration'
  policyHint: string
  execution: 'none'
}

export interface PreferenceCategoriesContract {
  kind: 'preference_categories'
  categories: readonly PreferenceCategoryId[]
  execution: 'none'
}

export interface CategoryPreferencesContract {
  kind: 'category_preferences'
  categoryId: PreferenceCategoryId
  preferenceHints: readonly string[]
  execution: 'none'
}

export interface PreferenceExtractionRegistryEntry {
  id: string
  sectionId: PreferenceExtractionSectionId
  label: string
  enabledHint: false
}

export interface PreferenceExtractionBlueprint {
  version: '7.4.0-preference-extraction'
  featureId: 'brain.preference_extraction'
  architectureOnly: true
  engine: PreferenceExtractionEngineContract
  conversationParser: ConversationPreferenceParserContract
  implicitDetector: ImplicitPreferenceDetectorContract
  explicitDetector: ExplicitPreferenceDetectorContract
  confidenceModel: PreferenceConfidenceModelContract
  conflictResolver: PreferenceConflictResolverContract
  freshnessModel: PreferenceFreshnessModelContract
  timeline: PreferenceTimelineContract
  revisionHistory: PreferenceRevisionHistoryContract
  sources: PreferenceSourcesContract
  mergeStrategy: PreferenceMergeStrategyContract
  validationRules: PreferenceValidationRulesContract
  confidenceScore: PreferenceConfidenceScoreContract
  weighting: PreferenceWeightingContract
  expiration: PreferenceExpirationContract
  categories: PreferenceCategoriesContract
  destinationPreferences: CategoryPreferencesContract
  accommodationPreferences: CategoryPreferencesContract
  transportationPreferences: CategoryPreferencesContract
  budgetPreferences: CategoryPreferencesContract
  foodPreferences: CategoryPreferencesContract
  activityPreferences: CategoryPreferencesContract
  languagePreferences: CategoryPreferencesContract
  accessibilityPreferences: CategoryPreferencesContract
  weatherPreferences: CategoryPreferencesContract
  travelStylePreferences: CategoryPreferencesContract
  /** Output contract samples (empty / placeholder). */
  extractedPreferences: readonly ExtractedPreference[]
  preferenceCandidates: readonly PreferenceCandidate[]
  preferenceEvidence: readonly PreferenceEvidence[]
  preferenceValidations: readonly PreferenceValidation[]
  preferenceUpdates: readonly PreferenceUpdate[]
  registry: readonly PreferenceExtractionRegistryEntry[]
}

export const PREFERENCE_EXTRACTION_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoLlms: false,
  wiredIntoDatabase: false,
  wiredIntoStorage: false,
  wiredIntoRuntime: false,
  recommendationExecution: false,
  httpRequests: false,
  wiredIntoApis: false,
  businessLogic: false,
  formFillingRequired: false,
} as const

export const PREFERENCE_CATEGORIES: readonly PreferenceCategoryId[] = [
  'destination',
  'accommodation',
  'transportation',
  'budget',
  'food',
  'activity',
  'language',
  'accessibility',
  'weather',
  'travel_style',
] as const

export const PREFERENCE_SOURCE_KINDS: readonly PreferenceSourceKind[] = [
  'explicit_utterance',
  'implicit_signal',
  'conversation_history',
  'revision',
  'merge',
  'architecture_placeholder',
] as const

export const PREFERENCE_EXTRACTION_SECTION_IDS: readonly PreferenceExtractionSectionId[] =
  [
    'preference_extraction_engine',
    'conversation_preference_parser',
    'implicit_preference_detector',
    'explicit_preference_detector',
    'preference_confidence_model',
    'preference_conflict_resolver',
    'preference_freshness_model',
    'preference_timeline',
    'preference_revision_history',
    'preference_sources',
    'preference_merge_strategy',
    'preference_validation_rules',
    'preference_confidence_score',
    'preference_weighting',
    'preference_expiration',
    'preference_categories',
    'destination_preferences',
    'accommodation_preferences',
    'transportation_preferences',
    'budget_preferences',
    'food_preferences',
    'activity_preferences',
    'language_preferences',
    'accessibility_preferences',
    'weather_preferences',
    'travel_style_preferences',
  ] as const

export const PREFERENCE_PIPELINE_STAGES = [
  'attach_conversation',
  'parse_utterances',
  'detect_explicit',
  'detect_implicit',
  'collect_evidence',
  'score_confidence',
  'validate',
  'resolve_conflicts',
  'merge',
  'check_freshness',
  'apply_expiration',
  'emit_updates',
  'append_timeline',
  'append_revision',
] as const

export type PreferencePipelineStageId =
  (typeof PREFERENCE_PIPELINE_STAGES)[number]
