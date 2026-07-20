/**
 * Sprint 52 — Executive OS package exports.
 */

export type {
  TravelGoal,
  ExecutiveStrategy,
  ObjectiveAxis,
  DestinationIntelligence,
  ScoredOption,
  PredictionResult,
  NegotiationSuggestion,
  SelfReviewFinding,
} from './types'

export {
  buildDestinationIntelligence,
  getAllDestinationIntelligence,
  getDestinationIntelligence,
} from './globalKnowledge'

export {
  buildTravelGraph,
  relatedDestinations,
} from './travelGraph'
export type {
  TravelGraph,
  TravelGraphNode,
  TravelGraphEdge,
  TravelGraphNodeKind,
} from './travelGraph'

export {
  cacheGet,
  cacheSet,
  cacheWrap,
  resetExecutiveOsCache,
} from './computationCache'

export { detectTravelGoal, goalAxisBoosts } from './goalDetection'
export { selectExecutiveStrategy, enginesForStrategy } from './strategySelection'
export { scoreDestinations, optimizeDecisions, paretoOptimal } from './scoring'
export { buildPrediction } from './prediction'
export { buildNegotiationSuggestions } from './negotiation'
export { isExecutiveOsEnabled, EXECUTIVE_OS_FEATURE_ID } from './feature'
