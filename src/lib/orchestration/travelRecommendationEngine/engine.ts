/**
 * Travel Recommendation Engine facade — builds architecture blueprints only.
 * Never books, contacts providers, or executes scoring.
 */

import { listTravelRecommendationRegistry } from './registry'
import { isBrainTravelRecommendationEnabled } from './registry'
import {
  buildAlternativeRecommendationsSample,
  buildRecommendationCandidateSample,
  buildRecommendationConfidenceContract,
  buildRecommendationEngine,
  buildRecommendationExplanation,
  buildRecommendationLifecycle,
  buildRecommendationPipeline,
  buildRecommendationRankingContract,
  buildRecommendationReasonSample,
  buildRecommendationRevisionContract,
  buildRecommendationRevisionSample,
  buildRecommendationSchema,
  buildRecommendationScoreSample,
  buildRecommendationScoring,
  buildRecommendationSnapshotContract,
  buildRecommendationStrategy,
  buildRecommendationValidationContract,
  buildTopRecommendationSample,
} from './pipelines'
import type {
  TravelRecommendationBlueprint,
  TravelRecommendationLocale,
} from './types'
import {
  TRAVEL_RECOMMENDATION_INPUT_HINTS,
  TRAVEL_RECOMMENDATION_ISOLATION,
} from './types'

export interface BuildTravelRecommendationBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: TravelRecommendationLocale
}

export function buildTravelRecommendationBlueprint(
  options: BuildTravelRecommendationBlueprintOptions = {},
): TravelRecommendationBlueprint {
  void options.sessionId
  void options.locale

  const ranking = buildRecommendationRankingContract()
  const confidence = buildRecommendationConfidenceContract()
  const validation = buildRecommendationValidationContract()
  const snapshot = buildRecommendationSnapshotContract()

  return {
    version: '7.9.0-travel-recommendation',
    featureId: 'brain.travel_recommendation',
    architectureOnly: true,
    engine: buildRecommendationEngine(),
    pipeline: buildRecommendationPipeline(),
    schema: buildRecommendationSchema(),
    strategy: buildRecommendationStrategy(),
    ranking,
    scoring: buildRecommendationScoring(),
    confidence,
    validation,
    lifecycle: buildRecommendationLifecycle(),
    snapshot,
    revision: buildRecommendationRevisionContract(),
    explanation: buildRecommendationExplanation(),
    recommendationCandidate: buildRecommendationCandidateSample(),
    recommendationScore: buildRecommendationScoreSample(),
    recommendationRanking: ranking.ranking,
    recommendationReason: buildRecommendationReasonSample(),
    recommendationConfidence: confidence.confidence,
    recommendationValidation: validation.validation,
    recommendationSnapshot: snapshot.snapshot,
    recommendationRevision: buildRecommendationRevisionSample(),
    topRecommendation: buildTopRecommendationSample(),
    alternativeRecommendations: buildAlternativeRecommendationsSample(),
    registry: listTravelRecommendationRegistry(),
    inputHints: TRAVEL_RECOMMENDATION_INPUT_HINTS,
  }
}

export function tryBuildTravelRecommendationBlueprint(
  options: BuildTravelRecommendationBlueprintOptions = {},
): TravelRecommendationBlueprint | null {
  if (!isBrainTravelRecommendationEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildTravelRecommendationBlueprint(options)
}

export function assertTravelRecommendationIsolation(): typeof TRAVEL_RECOMMENDATION_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...TRAVEL_RECOMMENDATION_ISOLATION,
    architectureOnly: true,
    registrySize: listTravelRecommendationRegistry().length,
  }
}

export const TravelRecommendationEngine = {
  buildBlueprint: buildTravelRecommendationBlueprint,
  tryBuildBlueprint: tryBuildTravelRecommendationBlueprint,
  assertIsolation: assertTravelRecommendationIsolation,
}
