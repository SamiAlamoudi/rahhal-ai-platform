/**
 * Offer Decision Engine contracts — pure builders.
 * No booking, provider calls, payments, or scoring execution.
 */

import type {
  OfferBundle,
  OfferCandidate,
  OfferConfidence,
  OfferConfidenceContract,
  OfferDecision,
  OfferDecisionEngineContract,
  OfferExplanation,
  OfferExplanationContract,
  OfferLifecycleContract,
  OfferPipelineContract,
  OfferRanking,
  OfferRankingContract,
  OfferRevision,
  OfferRevisionContract,
  OfferSchemaContract,
  OfferScore,
  OfferScoringContract,
  OfferSnapshot,
  OfferSnapshotContract,
  OfferStrategyContract,
  OfferValidation,
  OfferValidationContract,
} from './types'
import {
  TRAVEL_OFFER_LIFECYCLE_ACTIONS,
  TRAVEL_OFFER_PIPELINE_STAGES,
  TRAVEL_OFFER_SCORE_DIMENSIONS,
  TRAVEL_OFFER_STRATEGY_HINTS,
} from './types'

const ISO = '2026-07-25T00:00:00.000Z'
const DECISION_ID = 'odec-architecture'
const CANDIDATE_ID = 'ocand-architecture'
const BUNDLE_ID = 'obundle-architecture'
const RANKING_ID = 'orank-architecture'

export function buildOfferDecisionEngine(): OfferDecisionEngineContract {
  return {
    kind: 'travel_offer_decision_engine',
    version: '7.10.0-offer-decision',
    execution: 'none',
    books: false,
    providerCalled: false,
    paymentsCalculated: false,
  }
}

export function buildOfferPipeline(): OfferPipelineContract {
  return {
    kind: 'travel_offer_pipeline',
    stages: TRAVEL_OFFER_PIPELINE_STAGES,
    execution: 'none',
  }
}

export function buildOfferSchema(): OfferSchemaContract {
  return {
    kind: 'travel_offer_schema',
    outputKinds: [
      'travel_offer_candidate',
      'travel_offer_bundle',
      'travel_offer_decision',
      'travel_offer_ranking',
      'travel_offer_score',
      'travel_offer_explanation',
      'travel_offer_confidence',
      'travel_offer_validation',
      'travel_offer_revision',
      'travel_offer_snapshot',
    ],
    execution: 'none',
  }
}

export function buildOfferCandidateSample(): OfferCandidate {
  return {
    kind: 'travel_offer_candidate',
    candidateId: CANDIDATE_ID,
    sourceRecommendationHint: 'recommendation_result_placeholder',
    labelHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildOfferBundleSample(): OfferBundle {
  return {
    kind: 'travel_offer_bundle',
    bundleId: BUNDLE_ID,
    candidateIds: [],
    labelHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildOfferDecisionSample(): OfferDecision {
  return {
    kind: 'travel_offer_decision',
    decisionId: DECISION_ID,
    selectedCandidateId: null,
    selectedBundleId: null,
    strategyHint: 'best_overall',
    execution: 'none',
  }
}

export function buildOfferRankingSample(): OfferRanking {
  return {
    kind: 'travel_offer_ranking',
    rankingId: RANKING_ID,
    orderedCandidateIds: [],
    execution: 'none',
  }
}

export function buildOfferScoreSample(): OfferScore {
  return {
    kind: 'travel_offer_score',
    candidateId: CANDIDATE_ID,
    scoreHint: 0,
    dimensionHints: TRAVEL_OFFER_SCORE_DIMENSIONS,
    execution: 'none',
  }
}

export function buildOfferExplanationSample(): OfferExplanation {
  return {
    kind: 'travel_offer_explanation',
    explanationId: 'oexplain-architecture',
    decisionId: DECISION_ID,
    reasonHints: [],
    execution: 'none',
  }
}

export function buildOfferConfidenceSample(): OfferConfidence {
  return {
    kind: 'travel_offer_confidence',
    decisionId: DECISION_ID,
    scoreHint: 0,
    bandHint: 'medium',
    execution: 'none',
  }
}

export function buildOfferValidationSample(): OfferValidation {
  return {
    kind: 'travel_offer_validation',
    decisionId: DECISION_ID,
    valid: true,
    issues: [],
    execution: 'none',
  }
}

export function buildOfferRevisionSample(): OfferRevision {
  return {
    kind: 'travel_offer_revision',
    revisionId: 'orev-architecture',
    decisionId: DECISION_ID,
    reasonHint: 'architecture_blueprint',
    execution: 'none',
  }
}

export function buildOfferSnapshotSample(): OfferSnapshot {
  return {
    kind: 'travel_offer_snapshot',
    snapshotId: 'osnap-architecture',
    atIso: ISO,
    decisionId: DECISION_ID,
    execution: 'none',
  }
}

export function buildOfferStrategy(): OfferStrategyContract {
  return {
    kind: 'travel_offer_strategy',
    strategyHints: TRAVEL_OFFER_STRATEGY_HINTS,
    activeStrategyHint: null,
    execution: 'none',
  }
}

export function buildOfferScoring(): OfferScoringContract {
  return {
    kind: 'travel_offer_scoring',
    scores: [],
    executed: false,
    execution: 'none',
  }
}

export function buildOfferRankingContract(): OfferRankingContract {
  return {
    kind: 'travel_offer_ranking_contract',
    ranking: buildOfferRankingSample(),
    execution: 'none',
  }
}

export function buildOfferExplanationContract(): OfferExplanationContract {
  return {
    kind: 'travel_offer_explanation_contract',
    explanation: buildOfferExplanationSample(),
    execution: 'none',
  }
}

export function buildOfferConfidenceContract(): OfferConfidenceContract {
  return {
    kind: 'travel_offer_confidence_contract',
    confidence: buildOfferConfidenceSample(),
    execution: 'none',
  }
}

export function buildOfferValidationContract(): OfferValidationContract {
  return {
    kind: 'travel_offer_validation_contract',
    validation: buildOfferValidationSample(),
    execution: 'none',
  }
}

export function buildOfferLifecycle(): OfferLifecycleContract {
  return {
    kind: 'travel_offer_lifecycle',
    actions: TRAVEL_OFFER_LIFECYCLE_ACTIONS,
    currentActionHint: null,
    execution: 'none',
  }
}

export function buildOfferSnapshotContract(): OfferSnapshotContract {
  return {
    kind: 'travel_offer_snapshot_contract',
    snapshot: buildOfferSnapshotSample(),
    execution: 'none',
  }
}

export function buildOfferRevisionContract(): OfferRevisionContract {
  return {
    kind: 'travel_offer_revision_contract',
    revisions: [],
    persisted: false,
    execution: 'none',
  }
}
