export { DecisionEngine, createDecisionEngine, runDecisionEngine, type DecisionEngineInput } from './DecisionEngine'
export { dedupeCandidates } from './dedupe'
export { normalizeFlight, normalizeHotel, candidateKey } from './normalize'
export { executeSearchPlan, executeSearchPlansParallel } from './executePlans'
export { buildDecisionReasons, formatExplanation } from './explain'
export type {
  DecisionEngineResult,
  SearchCandidate,
  RecommendationBundle,
  DecisionReason,
} from '../types'
