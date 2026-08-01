/**
 * Sprint 84 — Travel Planning Engine public API.
 * Feature flag: `ai.brain.v1` (OFF by default).
 */

export {
  TRAVEL_PLANNING_ENGINE_VERSION,
  emptyTravelPlanSlots,
  type TravelGoal,
  type TravelGoalStatus,
  type TravelGoalPriority,
  type TravelPlan,
  type TravelPlanSlotKey,
  type TravelPlanSlots,
  type TravelPlanConstraint,
  type TravelPlanExecutionStep,
  type TravelPlanQuestion,
  type TravelPlanValidationResult,
  type TravelPlanValidationIssue,
  type PlanningConversationState,
  type ItinerarySkeleton,
  type ItineraryDaySkeleton,
  type TravelPlanningTurnInput,
  type TravelPlanningTurnResult,
} from './types'

export { TravelGoalModel, createTravelGoalModel } from './TravelGoalModel'
export { SlotFillingEngine, createSlotFillingEngine } from './SlotFillingEngine'
export {
  ConversationStateMachine,
  createConversationStateMachine,
} from './ConversationStateMachine'
export { QuestionPlanner, createQuestionPlanner } from './QuestionPlanner'
export {
  PlanRevisionEngine,
  createPlanRevisionEngine,
  createDefaultExecutionSteps,
} from './PlanRevision'
export { PlanValidator, createPlanValidator } from './PlanValidator'
export {
  ItinerarySkeletonBuilder,
  createItinerarySkeletonBuilder,
} from './ItinerarySkeletonBuilder'
export { PlanningRecovery, createPlanningRecovery } from './Recovery'
export {
  TravelPlanningEngine,
  createTravelPlanningEngine,
  runTravelPlanningTurn,
  type TravelPlanningEngineDeps,
} from './TravelPlanningEngine'
