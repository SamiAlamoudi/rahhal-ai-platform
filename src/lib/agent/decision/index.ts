export { applyIntelligentDecisions } from './decisionEngine'
export { detectTripConflicts } from './detectConflicts'
export {
  scoreFlightCandidate,
  scoreHotelCandidate,
  computeTripScores,
} from './scoreComponents'
export type {
  RegenerateScope,
  TripDecision,
  TripDecisionScores,
  DecisionRationale,
  DecisionAlternative,
  DecisionConflict,
} from './types'
