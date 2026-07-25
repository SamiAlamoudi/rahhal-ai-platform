/**
 * Preference extraction contracts — pure builders, no parsing or LLM.
 */

import type {
  CategoryPreferencesContract,
  ConversationPreferenceParserContract,
  ExplicitPreferenceDetectorContract,
  ImplicitPreferenceDetectorContract,
  PreferenceCategoriesContract,
  PreferenceCategoryId,
  PreferenceConfidenceModelContract,
  PreferenceConfidenceScoreContract,
  PreferenceConflictResolverContract,
  PreferenceExpirationContract,
  PreferenceExtractionEngineContract,
  PreferenceFreshnessModelContract,
  PreferenceMergeStrategyContract,
  PreferenceRevisionHistoryContract,
  PreferenceSourcesContract,
  PreferenceTimelineContract,
  PreferenceValidationRulesContract,
  PreferenceWeightingContract,
} from './types'
import { PREFERENCE_CATEGORIES, PREFERENCE_SOURCE_KINDS } from './types'

const ISO = '2026-07-25T00:00:00.000Z'

export function buildPreferenceExtractionEngine(): PreferenceExtractionEngineContract {
  return {
    kind: 'preference_extraction_engine',
    version: '7.4.0-preference-extraction',
    execution: 'none',
  }
}

export function buildConversationPreferenceParser(): ConversationPreferenceParserContract {
  return {
    kind: 'conversation_preference_parser',
    parseModeHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildImplicitPreferenceDetector(): ImplicitPreferenceDetectorContract {
  return {
    kind: 'implicit_preference_detector',
    signalHints: [],
    execution: 'none',
  }
}

export function buildExplicitPreferenceDetector(): ExplicitPreferenceDetectorContract {
  return {
    kind: 'explicit_preference_detector',
    utteranceHints: [],
    execution: 'none',
  }
}

export function buildPreferenceConfidenceModel(): PreferenceConfidenceModelContract {
  return {
    kind: 'preference_confidence_model',
    modelHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildPreferenceConflictResolver(): PreferenceConflictResolverContract {
  return {
    kind: 'preference_conflict_resolver',
    strategyHints: ['prefer_explicit', 'prefer_fresher', 'deny_unvalidated'],
    execution: 'none',
  }
}

export function buildPreferenceFreshnessModel(): PreferenceFreshnessModelContract {
  return {
    kind: 'preference_freshness_model',
    freshnessBandHint: 'unknown',
    execution: 'none',
  }
}

export function buildPreferenceTimeline(): PreferenceTimelineContract {
  return {
    kind: 'preference_timeline',
    events: [
      {
        eventId: 'pxtl-opened',
        eventKind: 'engine_opened',
        atIso: ISO,
        summary: 'architecture blueprint',
      },
    ],
    execution: 'none',
  }
}

export function buildPreferenceRevisionHistory(): PreferenceRevisionHistoryContract {
  return {
    kind: 'preference_revision_history',
    revisions: [],
    persisted: false,
    execution: 'none',
  }
}

export function buildPreferenceSources(): PreferenceSourcesContract {
  return {
    kind: 'preference_sources',
    sources: PREFERENCE_SOURCE_KINDS,
    execution: 'none',
  }
}

export function buildPreferenceMergeStrategy(): PreferenceMergeStrategyContract {
  return {
    kind: 'preference_merge_strategy',
    strategyHints: ['union_compatible', 'override_on_conflict_hint'],
    execution: 'none',
  }
}

export function buildPreferenceValidationRules(): PreferenceValidationRulesContract {
  return {
    kind: 'preference_validation_rules',
    ruleIds: [
      'require_category',
      'require_evidence_hint',
      'deny_empty_value',
    ],
    execution: 'none',
  }
}

export function buildPreferenceConfidenceScore(): PreferenceConfidenceScoreContract {
  return {
    kind: 'preference_confidence_score',
    scores: [],
    execution: 'none',
  }
}

export function buildPreferenceWeighting(): PreferenceWeightingContract {
  return {
    kind: 'preference_weighting',
    weightHints: PREFERENCE_CATEGORIES.map((categoryId) => ({
      categoryId,
      weightHint: 0,
    })),
    execution: 'none',
  }
}

export function buildPreferenceExpiration(): PreferenceExpirationContract {
  return {
    kind: 'preference_expiration',
    policyHint: 'none_architecture',
    execution: 'none',
  }
}

export function buildPreferenceCategories(): PreferenceCategoriesContract {
  return {
    kind: 'preference_categories',
    categories: PREFERENCE_CATEGORIES,
    execution: 'none',
  }
}

export function buildCategoryPreferences(
  categoryId: PreferenceCategoryId,
): CategoryPreferencesContract {
  return {
    kind: 'category_preferences',
    categoryId,
    preferenceHints: [],
    execution: 'none',
  }
}
