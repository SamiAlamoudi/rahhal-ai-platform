/**
 * Phase 7 Stage 4 — AI Smart Preference Extraction Engine barrel.
 *
 * Architecture / contracts / types / blueprints only.
 * Gated by `brain.preference_extraction` (default OFF).
 * No LLM, DB, storage, Runtime, recommendation execution, HTTP, or APIs.
 */

import { PREFERENCE_EXTRACTION_ISOLATION as PX_ISOLATION } from './types'
import {
  PREFERENCE_CATEGORIES,
  PREFERENCE_EXTRACTION_SECTION_IDS,
  PREFERENCE_PIPELINE_STAGES,
} from './types'

export {
  BRAIN_PREFERENCE_EXTRACTION_FEATURE_ID,
  isBrainPreferenceExtractionEnabled,
  listPreferenceExtractionRegistry,
  listPreferenceExtractionSectionIds,
  PreferenceExtractionRegistry,
  PREFERENCE_EXTRACTION_REGISTRY,
} from './registry'

export type {
  PreferenceExtractionLocale,
  PreferenceCategoryId,
  PreferenceSourceKind,
  PreferenceTimelineEventKind,
  PreferenceExtractionSectionId,
  PreferencePipelineStageId,
  ExtractedPreference,
  PreferenceCandidate,
  PreferenceEvidence,
  PreferenceConfidence,
  PreferenceValidation,
  PreferenceUpdate,
  PreferenceExtractionEngineContract,
  ConversationPreferenceParserContract,
  ImplicitPreferenceDetectorContract,
  ExplicitPreferenceDetectorContract,
  PreferenceConfidenceModelContract,
  PreferenceConflictResolverContract,
  PreferenceFreshnessModelContract,
  PreferenceTimelineEvent,
  PreferenceTimelineContract,
  PreferenceRevisionEntry,
  PreferenceRevisionHistoryContract,
  PreferenceSourcesContract,
  PreferenceMergeStrategyContract,
  PreferenceValidationRulesContract,
  PreferenceConfidenceScoreContract,
  PreferenceWeightingContract,
  PreferenceExpirationContract,
  PreferenceCategoriesContract,
  CategoryPreferencesContract,
  PreferenceExtractionRegistryEntry,
  PreferenceExtractionBlueprint,
} from './types'

export {
  PREFERENCE_EXTRACTION_ISOLATION,
  PREFERENCE_CATEGORIES,
  PREFERENCE_SOURCE_KINDS,
  PREFERENCE_EXTRACTION_SECTION_IDS,
  PREFERENCE_PIPELINE_STAGES,
} from './types'

export {
  buildPreferenceExtractionEngine,
  buildConversationPreferenceParser,
  buildImplicitPreferenceDetector,
  buildExplicitPreferenceDetector,
  buildPreferenceConfidenceModel,
  buildPreferenceConflictResolver,
  buildPreferenceFreshnessModel,
  buildPreferenceTimeline,
  buildPreferenceRevisionHistory,
  buildPreferenceSources,
  buildPreferenceMergeStrategy,
  buildPreferenceValidationRules,
  buildPreferenceConfidenceScore,
  buildPreferenceWeighting,
  buildPreferenceExpiration,
  buildPreferenceCategories,
  buildCategoryPreferences,
} from './pipelines'

export {
  PreferenceExtractionEngine,
  buildPreferenceExtractionBlueprint,
  tryBuildPreferenceExtractionBlueprint,
  assertPreferenceExtractionIsolation,
} from './engine'
export type { BuildPreferenceExtractionBlueprintOptions } from './engine'

export const PREFERENCE_EXTRACTION_ARCHITECTURE = {
  version: '7.4.0-preference-extraction',
  featureId: 'brain.preference_extraction' as const,
  architectureOnly: true,
  components: [
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
    'extracted_preference',
    'preference_candidate',
    'preference_evidence',
    'preference_confidence',
    'preference_validation',
    'preference_update',
  ] as const,
  categories: PREFERENCE_CATEGORIES,
  pipelineStages: PREFERENCE_PIPELINE_STAGES,
  sectionIds: PREFERENCE_EXTRACTION_SECTION_IDS,
  ...PX_ISOLATION,
} as const
