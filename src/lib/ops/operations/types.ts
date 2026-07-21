/**
 * Sprint 69 — Real Beta Operations & Production Monitoring types.
 */

export type OpsEnvironment = 'development' | 'staging' | 'beta' | 'production'

export type GoNoGoDecision = 'go' | 'no_go' | 'conditional_go'

export interface EnvironmentSwitchResult {
  from: OpsEnvironment
  to: OpsEnvironment
  ok: boolean
  verified: boolean
  report: string
  generatedAt: string
}

export interface EnvironmentRuntimeReport {
  environment: OpsEnvironment
  ok: boolean
  checks: Array<{ id: string; ok: boolean; detail: string }>
  generatedAt: string
}

export interface ProviderMonitorMetrics {
  providerId: string
  availability: number
  latencyMs: number
  successRate: number
  failureRate: number
  timeouts: number
  retries: number
  status: 'healthy' | 'degraded' | 'unhealthy' | 'idle'
}

export interface PaymentMonitorMetrics {
  providerId: string
  mode: 'live' | 'sandbox' | 'mock' | 'future'
  success: number
  failure: number
  timeout: number
  retries: number
  refundPathReady: boolean
  status: 'healthy' | 'degraded' | 'unhealthy' | 'idle'
}

export interface NotificationMonitorMetrics {
  channel: 'email' | 'whatsapp' | 'push' | 'sms'
  deliveryRate: number
  retryRate: number
  queueHealth: 'healthy' | 'degraded' | 'unhealthy'
  sent: number
  failed: number
  retries: number
}

export interface DashboardPanel {
  id: string
  title: string
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  metrics: Record<string, number | string | boolean>
  notes: string[]
}

export interface ProductionOpsDashboard {
  conversation: DashboardPanel
  search: DashboardPanel
  recommendation: DashboardPanel
  booking: DashboardPanel
  trips: DashboardPanel
  documents: DashboardPanel
  payments: DashboardPanel
  providers: DashboardPanel
  notifications: DashboardPanel
  system: DashboardPanel
  overall: 'healthy' | 'degraded' | 'unhealthy'
  generatedAt: string
}

export type OpsReportKind =
  | 'daily'
  | 'weekly'
  | 'provider'
  | 'booking'
  | 'conversation'
  | 'trip'
  | 'revenue'
  | 'system'

export interface OperationalReport {
  kind: OpsReportKind
  title: string
  summary: string
  metrics: Record<string, number | string>
  generatedAt: string
}

export interface OpsIncidentReport {
  incidentId: string
  title: string
  severity: string
  status: string
  timeline: Array<{ at: string; status: string; note: string }>
  recoveryLog: string[]
  resolution: string | null
  postmortemTemplate: string
  generatedAt: string
}

export interface OpsSmokeResult {
  ok: boolean
  checks: Array<{ id: string; label: string; ok: boolean; detail: string }>
  durationMs: number
  correlationId?: string
  generatedAt: string
}

export interface OperationalAnalytics {
  searches: number
  bookings: number
  conversions: number
  failures: number
  retries: number
  topDestinations: string[]
  providerUsage: Record<string, number>
  averageResponseTimeMs: number
  generatedAt: string
}

export interface ProviderStatusReport {
  providers: ProviderMonitorMetrics[]
  overall: 'healthy' | 'degraded' | 'unhealthy'
  generatedAt: string
}

export interface BetaOperationsReadinessReport {
  ok: boolean
  betaReady: boolean
  readinessScore: number
  decision: GoNoGoDecision
  recommendation: string
  environment: OpsEnvironment
  environmentReport: EnvironmentRuntimeReport
  dashboard: ProductionOpsDashboard
  providerStatus: ProviderStatusReport
  payments: PaymentMonitorMetrics[]
  notifications: NotificationMonitorMetrics[]
  analytics: OperationalAnalytics
  smoke: OpsSmokeResult
  operationsReport: OperationalReport
  openIncidents: number
  generatedAt: string
  version: string
}
