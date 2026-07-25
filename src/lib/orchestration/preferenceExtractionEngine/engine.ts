/**
 * Preference Extraction Engine facade — builds architecture blueprints only.
 * Never parses conversations, calls LLMs, or persists preferences.
 */

import { listPreferenceExtractionRegistry } from './registry'
import { isBrainPreferenceExtractionEnabled } from './registry'
import {
  buildCategoryPreferences,
  buildConversationPreferenceParser,
  buildExplicitPreferenceDetector,
  buildImplicitPreferenceDetector,
  buildPreferenceCategories,
  buildPreferenceConfidenceModel,
  buildPreferenceConfidenceScore,
  buildPreferenceConflictResolver,
  buildPreferenceExpiration,
  buildPreferenceExtractionEngine,
  buildPreferenceFreshnessModel,
  buildPreferenceMergeStrategy,
  buildPreferenceRevisionHistory,
  buildPreferenceSources,
  buildPreferenceTimeline,
  buildPreferenceValidationRules,
  buildPreferenceWeighting,
} from './pipelines'
import type {
  PreferenceExtractionBlueprint,
  PreferenceExtractionLocale,
} from './types'
import { PREFERENCE_EXTRACTION_ISOLATION } from './types'

export interface BuildPreferenceExtractionBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: PreferenceExtractionLocale
}

export function buildPreferenceExtractionBlueprint(
  options: BuildPreferenceExtractionBlueprintOptions = {},
): PreferenceExtractionBlueprint {
  void options.sessionId
  void options.locale

  return {
    version: '7.4.0-preference-extraction',
    featureId: 'brain.preference_extraction',
    architectureOnly: true,
    engine: buildPreferenceExtractionEngine(),
    conversationParser: buildConversationPreferenceParser(),
    implicitDetector: buildImplicitPreferenceDetector(),
    explicitDetector: buildExplicitPreferenceDetector(),
    confidenceModel: buildPreferenceConfidenceModel(),
    conflictResolver: buildPreferenceConflictResolver(),
    freshnessModel: buildPreferenceFreshnessModel(),
    timeline: buildPreferenceTimeline(),
    revisionHistory: buildPreferenceRevisionHistory(),
    sources: buildPreferenceSources(),
    mergeStrategy: buildPreferenceMergeStrategy(),
    validationRules: buildPreferenceValidationRules(),
    confidenceScore: buildPreferenceConfidenceScore(),
    weighting: buildPreferenceWeighting(),
    expiration: buildPreferenceExpiration(),
    categories: buildPreferenceCategories(),
    destinationPreferences: buildCategoryPreferences('destination'),
    accommodationPreferences: buildCategoryPreferences('accommodation'),
    transportationPreferences: buildCategoryPreferences('transportation'),
    budgetPreferences: buildCategoryPreferences('budget'),
    foodPreferences: buildCategoryPreferences('food'),
    activityPreferences: buildCategoryPreferences('activity'),
    languagePreferences: buildCategoryPreferences('language'),
    accessibilityPreferences: buildCategoryPreferences('accessibility'),
    weatherPreferences: buildCategoryPreferences('weather'),
    travelStylePreferences: buildCategoryPreferences('travel_style'),
    extractedPreferences: [],
    preferenceCandidates: [],
    preferenceEvidence: [],
    preferenceValidations: [],
    preferenceUpdates: [],
    registry: listPreferenceExtractionRegistry(),
  }
}

export function tryBuildPreferenceExtractionBlueprint(
  options: BuildPreferenceExtractionBlueprintOptions = {},
): PreferenceExtractionBlueprint | null {
  if (!isBrainPreferenceExtractionEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildPreferenceExtractionBlueprint(options)
}

export function assertPreferenceExtractionIsolation(): typeof PREFERENCE_EXTRACTION_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...PREFERENCE_EXTRACTION_ISOLATION,
    architectureOnly: true,
    registrySize: listPreferenceExtractionRegistry().length,
  }
}

export const PreferenceExtractionEngine = {
  buildBlueprint: buildPreferenceExtractionBlueprint,
  tryBuildBlueprint: tryBuildPreferenceExtractionBlueprint,
  assertIsolation: assertPreferenceExtractionIsolation,
}
