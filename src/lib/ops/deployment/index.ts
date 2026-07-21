/**
 * Sprint 68 — Production Deployment & Launch Automation.
 */

export type {
  DeployProfileName,
  DeployProfile,
  GateStatus,
  ChecklistItemStatus,
  SecretCheckItem,
  SecretValidationReport,
  SubsystemHealth,
  ProductionHealthReport,
  ProductionMetricsSnapshot,
  RollbackKind,
  RollbackStep,
  RollbackPlan,
  AlertEvaluationReport,
  CICDGate,
  CICDPipelineReport,
  GoLiveChecklistItem,
  FeatureMatrixEntry,
  ReleaseAutomationArtifacts,
  ProductionValidationGate,
  DeploymentLaunchReport,
} from './types'

export {
  DEPLOY_PROFILES,
  getDeployProfile,
  detectDeployProfile,
} from './profiles'

export { validateProductionSecrets } from './secrets'
export { buildProductionHealthReport } from './health'
export { collectProductionMetrics } from './metrics'
export {
  evaluateProductionAlerts,
  PRODUCTION_ALERT_CLASSES,
} from './alerts'
export { buildRollbackPlan, triggerRollback } from './rollback'
export {
  buildCICDPipelineReport,
  buildPassingCICDReport,
  type CICDGateInput,
} from './cicd'
export {
  RAHHAL_V1_RELEASE_VERSION,
  RAHHAL_V1_RC_VERSION,
  SPRINT68_DEPLOYMENT_VERSION,
  KNOWN_LIMITATIONS_V1,
  buildFeatureMatrix,
  buildGoLiveChecklist,
  generateReleaseArtifacts,
} from './release'
export { runDeploymentValidation } from './validation'
export {
  computeReadinessScore,
  generateDeploymentLaunchReport,
  isProductionDeploymentReady,
  runProductionDeploymentPreflight,
} from './report'
export { installDeploymentAutomation } from './install'
