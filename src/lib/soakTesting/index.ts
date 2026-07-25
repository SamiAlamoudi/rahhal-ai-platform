/**
 * Sprint 19 — Staging Soak Testing barrel (flag OFF by default).
 */

export { SOAK_TESTING_VERSION } from './types'
export type {
  ConcurrencyResult,
  HeapSample,
  MemoryLeakReport,
  ReadinessScores,
  SoakProfile,
  SoakProfileId,
  SoakReport,
  SoakRunMetrics,
} from './types'

export {
  SOAK_STAGING_FEATURE_ID,
  isSoakStagingEnabled,
} from './feature'

export { SOAK_PROFILES, getSoakProfile } from './profiles'
export { sampleHeap } from './heap'
export { SoakRunner, createSoakRunner } from './SoakRunner'
export { MemoryLeakValidator, createMemoryLeakValidator } from './MemoryLeakValidator'
export { runFailureDurability } from './FailureDurability'
export {
  StagingSoakOrchestrator,
  createStagingSoakOrchestrator,
  SOAK_SPRINT19_EVIDENCE,
  type SoakEvidence,
} from './StagingSoakOrchestrator'
