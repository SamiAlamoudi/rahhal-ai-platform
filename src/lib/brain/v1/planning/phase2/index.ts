/**
 * Sprint 89 Phase 2 — planning facade exports.
 * T2: MissingInformationPlanner only. No BrainRouter / CM wiring.
 */

export {
  MISSING_INFORMATION_PLANNER_VERSION,
  BOOKING_ONLY_FIELDS,
  MissingInformationPlanner,
  createMissingInformationPlanner,
  planMissingInformation,
  type MissingInfoGoal,
  type MissingFieldClassification,
  type MissingFieldReasonCode,
  type MissingFieldEntry,
  type ClarificationQuestionCandidate,
  type MissingInformationPlannerInput,
  type MissingInformationResult,
} from './MissingInformationPlanner'
