/**
 * Sprint 84 — Autonomous Itinerary Refinement Engine (core barrel).
 */

export {
  ItineraryRefiner,
  createItineraryRefiner,
  runItineraryRefinement,
  SPRINT84_ITINERARY_REFINEMENT_VERSION,
  type RefinementRequest,
  type RefinementResult,
  type RefinementLearningSignal,
} from './ItineraryRefiner'

export {
  planRefinement,
  detectRefinementChanges,
  type RefinementChangeKind,
  type RefinementPlan,
} from './RefinementPlanner'

export {
  resolveConstraints,
  type HardConstraintKind,
  type SoftConstraintKind,
} from './ConstraintResolver'

export { detectConflicts, type RefinementConflict } from './ConflictDetector'
export { analyzeTimeWindows, isEarlyFlight, type TimeWindowAnalysis } from './TimeWindowAnalyzer'
export { optimizeSchedule } from './ScheduleOptimizer'
export { optimizeTransfers } from './TransferOptimizer'
export { balanceActivities } from './ActivityBalancer'
export {
  analyzeRefinementRisk,
  refinementConfidence,
  type RefinementRisk,
} from './RiskAnalyzer'
export {
  generateAlternatives,
  type RefinementAlternative,
} from './AlternativeGenerator'
export {
  buildRefinementExplanation,
  type RefinementExplanation,
} from './ExplanationBuilder'
export {
  emitRefinementEvent,
  onRefinementEvent,
  resetRefinementEventListeners,
  type RefinementEvent,
  type RefinementEventName,
} from './events'
