/**
 * Sprint 16 — Load Testing & Resilience barrel.
 * Additive; feature flag `load_testing.platform` OFF by default.
 * Do not import from ChatPage hot paths.
 */

export { LOAD_TESTING_PLATFORM_VERSION } from './types'
export type {
  AggregatedLatency,
  CapacityEstimate,
  FailureInjectionConfig,
  FailureInjectionKind,
  LoadRunReport,
  LoadStepResult,
  ResilienceValidation,
  SessionOutcome,
  SessionResult,
  StressProfile,
  StressScenarioId,
} from './types'

export {
  LOAD_TESTING_PLATFORM_FEATURE_ID,
  isLoadTestingPlatformEnabled,
} from './feature'

export {
  STRESS_PROFILES,
  getStressProfile,
  listStressProfiles,
  scaleProfileForTests,
} from './StressProfile'

export {
  FailureInjector,
  createFailureInjector,
} from './FailureInjector'

export {
  ResilienceSimulator,
  createResilienceSimulator,
} from './ResilienceSimulator'

export {
  ScenarioExecutor,
  createScenarioExecutor,
} from './ScenarioExecutor'

export {
  ConcurrentSessionRunner,
  createConcurrentSessionRunner,
} from './ConcurrentSessionRunner'

export {
  ResultAggregator,
  createResultAggregator,
} from './ResultAggregator'

export {
  CapacityEstimator,
  createCapacityEstimator,
} from './CapacityEstimator'

export {
  LoadRunner,
  createLoadRunner,
  getLoadRunner,
  resetLoadRunnerForTests,
  type LoadRunOptions,
} from './LoadRunner'
