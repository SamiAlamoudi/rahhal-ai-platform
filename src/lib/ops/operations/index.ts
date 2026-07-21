/**
 * Sprint 69 — Real Beta Operations & Production Monitoring.
 */

export type {
  OpsEnvironment,
  GoNoGoDecision,
  EnvironmentSwitchResult,
  EnvironmentRuntimeReport,
  ProviderMonitorMetrics,
  PaymentMonitorMetrics,
  NotificationMonitorMetrics,
  DashboardPanel,
  ProductionOpsDashboard,
  OpsReportKind,
  OperationalReport,
  OpsIncidentReport,
  OpsSmokeResult,
  OperationalAnalytics,
  ProviderStatusReport,
  BetaOperationsReadinessReport,
} from './types'

export {
  toOpsEnvironment,
  detectOpsEnvironment,
  switchOpsEnvironment,
  verifyOpsEnvironment,
  buildEnvironmentReport,
} from './environment'

export {
  collectProviderMonitorMetrics,
  buildProviderStatusReport,
} from './providerMonitoring'

export { collectPaymentMonitorMetrics } from './paymentMonitoring'
export { collectNotificationMonitorMetrics } from './notificationMonitoring'
export { buildProductionOpsDashboard } from './dashboards'
export {
  generateOperationalReport,
  generateAllOperationalReports,
} from './reports'
export {
  createOpsIncident,
  appendIncidentRecovery,
  resolveOpsIncident,
  buildOpsIncidentReport,
  syncAlertsToIncidents,
  listOpenOpsIncidents,
} from './incidents'
export { runOperationsSmokeTests } from './smoke'
export { collectOperationalAnalytics } from './analytics'
export {
  SPRINT69_OPERATIONS_VERSION,
  computeBetaOpsReadinessScore,
  decideGoNoGo,
  generateBetaOperationsReadinessReport,
  runBetaOperationsPreflight,
} from './readiness'
export { installBetaOperationsMonitoring } from './install'
