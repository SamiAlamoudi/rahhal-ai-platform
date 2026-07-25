/**
 * Offer Decision Engine facade — builds architecture blueprints only.
 * Never books, contacts providers, calculates payments, or executes scoring.
 */

import { listTravelOfferDecisionRegistry } from './registry'
import { isBrainOfferDecisionEngineEnabled } from './registry'
import {
  buildOfferBundleSample,
  buildOfferCandidateSample,
  buildOfferConfidenceContract,
  buildOfferDecisionEngine,
  buildOfferDecisionSample,
  buildOfferExplanationContract,
  buildOfferLifecycle,
  buildOfferPipeline,
  buildOfferRankingContract,
  buildOfferRevisionContract,
  buildOfferRevisionSample,
  buildOfferSchema,
  buildOfferScoreSample,
  buildOfferScoring,
  buildOfferSnapshotContract,
  buildOfferStrategy,
  buildOfferValidationContract,
} from './pipelines'
import type {
  TravelOfferDecisionBlueprint,
  TravelOfferDecisionLocale,
} from './types'
import {
  TRAVEL_OFFER_DECISION_ISOLATION,
  TRAVEL_OFFER_INPUT_HINTS,
} from './types'

export interface BuildTravelOfferDecisionBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: TravelOfferDecisionLocale
}

export function buildTravelOfferDecisionBlueprint(
  options: BuildTravelOfferDecisionBlueprintOptions = {},
): TravelOfferDecisionBlueprint {
  void options.sessionId
  void options.locale

  const ranking = buildOfferRankingContract()
  const explanation = buildOfferExplanationContract()
  const confidence = buildOfferConfidenceContract()
  const validation = buildOfferValidationContract()
  const snapshot = buildOfferSnapshotContract()

  return {
    version: '7.10.0-offer-decision',
    featureId: 'brain.offer_decision_engine',
    architectureOnly: true,
    engine: buildOfferDecisionEngine(),
    pipeline: buildOfferPipeline(),
    schema: buildOfferSchema(),
    strategy: buildOfferStrategy(),
    scoring: buildOfferScoring(),
    ranking,
    explanation,
    confidence,
    validation,
    lifecycle: buildOfferLifecycle(),
    snapshot,
    revision: buildOfferRevisionContract(),
    offerCandidate: buildOfferCandidateSample(),
    offerBundle: buildOfferBundleSample(),
    offerDecision: buildOfferDecisionSample(),
    offerRanking: ranking.ranking,
    offerScore: buildOfferScoreSample(),
    offerExplanation: explanation.explanation,
    offerConfidence: confidence.confidence,
    offerValidation: validation.validation,
    offerRevision: buildOfferRevisionSample(),
    offerSnapshot: snapshot.snapshot,
    registry: listTravelOfferDecisionRegistry(),
    inputHints: TRAVEL_OFFER_INPUT_HINTS,
  }
}

export function tryBuildTravelOfferDecisionBlueprint(
  options: BuildTravelOfferDecisionBlueprintOptions = {},
): TravelOfferDecisionBlueprint | null {
  if (!isBrainOfferDecisionEngineEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildTravelOfferDecisionBlueprint(options)
}

export function assertTravelOfferDecisionIsolation(): typeof TRAVEL_OFFER_DECISION_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...TRAVEL_OFFER_DECISION_ISOLATION,
    architectureOnly: true,
    registrySize: listTravelOfferDecisionRegistry().length,
  }
}

export const TravelOfferDecisionEngine = {
  buildBlueprint: buildTravelOfferDecisionBlueprint,
  tryBuildBlueprint: tryBuildTravelOfferDecisionBlueprint,
  assertIsolation: assertTravelOfferDecisionIsolation,
}
