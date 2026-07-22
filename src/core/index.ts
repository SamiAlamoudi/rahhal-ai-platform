/**
 * Sprint 79 — Autonomous Search & Decision Engine (core barrel).
 * Sprint 80 — Adaptive Learning & Profile (additive exports).
 */

export type {
  SearchPlan,
  SearchCandidate,
  SearchScore,
  DecisionReason,
  RecommendationBundle,
  DecisionEngineResult,
  DecisionEvent,
  ScoringWeights,
  ScoringDimension,
  RecommendationLabel,
  SearchPlanObjective,
} from './types'
export { SPRINT79_DECISION_ENGINE_VERSION } from './types'

export { createSearchPlans, type StrategyContext } from './searchPlanner'
export { scoreItinerary, DEFAULT_SCORING_WEIGHTS } from './searchScoring'
export { rankCandidates, pickRecommendationBundle } from './searchRanking'
export {
  DecisionEngine,
  createDecisionEngine,
  runDecisionEngine,
  dedupeCandidates,
  normalizeFlight,
  normalizeHotel,
  executeSearchPlan,
  executeSearchPlansParallel,
  buildDecisionReasons,
  formatExplanation,
} from './decisionEngine'
export {
  emitDecisionEvent,
  onDecisionEvent,
  resetDecisionEventListeners,
} from './observability/events'

export * from './profile'
export * from './learning'
export * from './priceIntelligence'
export * from './packageBuilder'
export * from './constitution'
export * from './providers'
