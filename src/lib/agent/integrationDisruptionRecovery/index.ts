/**
 * Integration Sprint 10 — Live Disruption Recovery barrel.
 * Feature-gated by `ai.integration_disruption_recovery` (default OFF).
 */

export { INTEGRATION_DISRUPTION_RECOVERY_VERSION } from './types'
export type {
  AutoReplanSnapshot,
  DetectedLiveDisruption,
  DisruptionImpact,
  DisruptionKind,
  DisruptionRecoveryIntent,
  DisruptionRecoveryResult,
  DisruptionRiskLevel,
  LiveAlertSource,
  LiveDisruptionAlert,
  LiveDisruptionAlertProvider,
  RecoveryPlan,
  RecoveryStrategy,
} from './types'

export {
  INTEGRATION_DISRUPTION_RECOVERY_FEATURE_ID,
  isIntegrationDisruptionRecoveryEnabled,
} from './feature'

export {
  detectDisruptionKind,
  detectLiveDisruption,
  detectRecoveryIntent,
  scoreRisk,
} from './detector'

export { analyzeDisruptionImpact } from './impact'
export { planRecoveryOptions } from './recoveryPlanner'
export { buildAutoReplan } from './replan'
export {
  FUTURE_LIVE_ALERT_CAPABILITIES,
  MockLiveDisruptionAlertProvider,
  createMockLiveDisruptionAlertProvider,
} from './liveAlerts'
export { buildDisruptionRecoverySummary } from './consultant'

export {
  DisruptionEngine,
  createDisruptionEngine,
  runDisruptionRecovery,
  type DisruptionRecoveryDeps,
  type RunDisruptionRecoveryInput,
} from './engine'

export {
  enrichWithIntegrationDisruptionRecovery,
  shouldRunDisruptionRecovery,
  toDisruptionRecoveryMeta,
} from './enrich'
