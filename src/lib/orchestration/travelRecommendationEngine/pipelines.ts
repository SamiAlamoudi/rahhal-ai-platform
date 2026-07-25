/**
 * Travel Recommendation Engine contracts — pure builders.
 * No booking, provider calls, or scoring execution.
 */

import type {
  AlternativeRecommendation,
  RecommendationCandidate,
  RecommendationConfidence,
  RecommendationConfidenceContract,
  RecommendationEngineContract,
  RecommendationExplanationContract,
  RecommendationLifecycleContract,
  RecommendationPipelineContract,
  RecommendationRanking,
  RecommendationRankingContract,
  RecommendationReason,
  RecommendationRevision,
  RecommendationRevisionContract,
  RecommendationSchemaContract,
  RecommendationScore,
  RecommendationScoringContract,
  RecommendationSnapshot,
  RecommendationSnapshotContract,
  RecommendationStrategyContract,
  RecommendationValidation,
  RecommendationValidationContract,
  TopRecommendation,
} from './types'
import {
  TRAVEL_RECOMMENDATION_LIFECYCLE_ACTIONS,
  TRAVEL_RECOMMENDATION_PIPELINE_STAGES,
  TRAVEL_RECOMMENDATION_SCORE_DIMENSIONS,
} from './types'

const ISO = '2026-07-25T00:00:00.000Z'
const RANKING_ID = 'rrank-architecture'
const CANDIDATE_ID = 'rcand-architecture'

export function buildRecommendationEngine(): RecommendationEngineContract {
  return {
    kind: 'travel_recommendation_engine',
    version: '7.9.0-travel-recommendation',
    execution: 'none',
    books: false,
    providerCalled: false,
  }
}

export function buildRecommendationPipeline(): RecommendationPipelineContract {
  return {
    kind: 'travel_recommendation_pipeline',
    stages: TRAVEL_RECOMMENDATION_PIPELINE_STAGES,
    execution: 'none',
  }
}

export function buildRecommendationSchema(): RecommendationSchemaContract {
  return {
    kind: 'travel_recommendation_schema',
    outputKinds: [
      'travel_recommendation_candidate',
      'travel_recommendation_score',
      'travel_recommendation_ranking',
      'travel_recommendation_reason',
      'travel_recommendation_confidence',
      'travel_recommendation_validation',
      'travel_recommendation_snapshot',
      'travel_recommendation_revision',
      'top_recommendation',
      'alternative_recommendation',
    ],
    execution: 'none',
  }
}

export function buildRecommendationCandidateSample(): RecommendationCandidate {
  return {
    kind: 'travel_recommendation_candidate',
    candidateId: CANDIDATE_ID,
    sourceSearchCandidateHint: 'search_candidate_placeholder',
    labelHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildRecommendationScoreSample(): RecommendationScore {
  return {
    kind: 'travel_recommendation_score',
    candidateId: CANDIDATE_ID,
    scoreHint: 0,
    dimensionHints: TRAVEL_RECOMMENDATION_SCORE_DIMENSIONS,
    execution: 'none',
  }
}

export function buildRecommendationRankingSample(): RecommendationRanking {
  return {
    kind: 'travel_recommendation_ranking',
    rankingId: RANKING_ID,
    orderedCandidateIds: [],
    execution: 'none',
  }
}

export function buildRecommendationReasonSample(): RecommendationReason {
  return {
    kind: 'travel_recommendation_reason',
    reasonId: 'rreason-architecture',
    candidateId: CANDIDATE_ID,
    reasonHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildRecommendationConfidenceSample(): RecommendationConfidence {
  return {
    kind: 'travel_recommendation_confidence',
    candidateId: CANDIDATE_ID,
    scoreHint: 0,
    bandHint: 'medium',
    execution: 'none',
  }
}

export function buildRecommendationValidationSample(): RecommendationValidation {
  return {
    kind: 'travel_recommendation_validation',
    rankingId: RANKING_ID,
    valid: true,
    issues: [],
    execution: 'none',
  }
}

export function buildRecommendationSnapshotSample(): RecommendationSnapshot {
  return {
    kind: 'travel_recommendation_snapshot',
    snapshotId: 'rsnap-architecture',
    atIso: ISO,
    rankingId: RANKING_ID,
    execution: 'none',
  }
}

export function buildRecommendationRevisionSample(): RecommendationRevision {
  return {
    kind: 'travel_recommendation_revision',
    revisionId: 'rrev-architecture',
    rankingId: RANKING_ID,
    reasonHint: 'architecture_blueprint',
    execution: 'none',
  }
}

export function buildTopRecommendationSample(): TopRecommendation {
  return {
    kind: 'top_recommendation',
    candidateId: null,
    labelHint: 'none_architecture',
    execution: 'none',
  }
}

export function buildAlternativeRecommendationsSample(): AlternativeRecommendation[] {
  return []
}

export function buildRecommendationStrategy(): RecommendationStrategyContract {
  return {
    kind: 'travel_recommendation_strategy',
    strategyHints: [
      'rank_only',
      'never_book',
      'never_call_providers',
      'prefer_constraints_over_suggestions',
    ],
    execution: 'none',
  }
}

export function buildRecommendationRankingContract(): RecommendationRankingContract {
  return {
    kind: 'travel_recommendation_ranking_contract',
    ranking: buildRecommendationRankingSample(),
    execution: 'none',
  }
}

export function buildRecommendationScoring(): RecommendationScoringContract {
  return {
    kind: 'travel_recommendation_scoring',
    scores: [],
    executed: false,
    execution: 'none',
  }
}

export function buildRecommendationConfidenceContract(): RecommendationConfidenceContract {
  return {
    kind: 'travel_recommendation_confidence_contract',
    confidence: buildRecommendationConfidenceSample(),
    execution: 'none',
  }
}

export function buildRecommendationValidationContract(): RecommendationValidationContract {
  return {
    kind: 'travel_recommendation_validation_contract',
    validation: buildRecommendationValidationSample(),
    execution: 'none',
  }
}

export function buildRecommendationLifecycle(): RecommendationLifecycleContract {
  return {
    kind: 'travel_recommendation_lifecycle',
    actions: TRAVEL_RECOMMENDATION_LIFECYCLE_ACTIONS,
    currentActionHint: null,
    execution: 'none',
  }
}

export function buildRecommendationSnapshotContract(): RecommendationSnapshotContract {
  return {
    kind: 'travel_recommendation_snapshot_contract',
    snapshot: buildRecommendationSnapshotSample(),
    execution: 'none',
  }
}

export function buildRecommendationRevisionContract(): RecommendationRevisionContract {
  return {
    kind: 'travel_recommendation_revision_contract',
    revisions: [],
    persisted: false,
    execution: 'none',
  }
}

export function buildRecommendationExplanation(): RecommendationExplanationContract {
  return {
    kind: 'travel_recommendation_explanation',
    reasons: [],
    execution: 'none',
  }
}
