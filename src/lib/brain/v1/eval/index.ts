/**
 * Sprint 88 Task 4 — Golden evaluation public API.
 */

export {
  GOLDEN_EVAL_CONTRACT_VERSION,
  type GoldenScenarioId,
  type GoldenLocale,
  type GoldenUserTurn,
  type GoldenBehavioralAssertion,
  type GoldenForbiddenBehavior,
  type GoldenScenario,
  type GoldenEvaluationResult,
  type GoldenSuiteResult,
} from './types'

export {
  evaluateGoldenScenario,
  evaluateGoldenSuite,
  type GoldenEvaluateOptions,
} from './runner'

export {
  GOLDEN_SCENARIOS,
  getGoldenScenario,
  G01_VALUE_FIRST,
  G02_ZERO_QUESTIONS,
  G03_MULTI_TURN_REFINE,
  G04_BOOKING_DEFERRAL,
  G05_SAFE_FALLBACK,
} from './fixtures'
