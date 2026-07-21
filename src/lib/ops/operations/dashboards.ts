/**
 * Sprint 69 — Production operational dashboards.
 */

import { buildProductionHealthReport, collectProductionMetrics } from '../deployment'
import { collectMonitoringSnapshot } from '../observability/monitoring'
import { collectNotificationMonitorMetrics } from './notificationMonitoring'
import { collectPaymentMonitorMetrics } from './paymentMonitoring'
import { buildProviderStatusReport } from './providerMonitoring'
import type {
  DashboardPanel,
  OpsEnvironment,
  ProductionOpsDashboard,
} from './types'

function panel(
  id: string,
  title: string,
  status: DashboardPanel['status'],
  metrics: DashboardPanel['metrics'],
  notes: string[] = [],
): DashboardPanel {
  return { id, title, status, metrics, notes }
}

export function buildProductionOpsDashboard(
  environment: OpsEnvironment = 'beta',
): ProductionOpsDashboard {
  const health = buildProductionHealthReport({
    profile: environment === 'beta' ? 'beta' : environment,
    paymentProvider: 'mock',
    supabaseConfigured: true,
  })
  const metrics = collectProductionMetrics()
  const monitoring = collectMonitoringSnapshot()
  const providers = buildProviderStatusReport(environment)
  const payments = collectPaymentMonitorMetrics(environment)
  const notifications = collectNotificationMonitorMetrics()

  const byId = (id: string) => health.subsystems.find((s) => s.id === id)

  const conversation = panel(
    'conversation',
    'Conversation',
    byId('conversation')?.status === 'unhealthy' ? 'unhealthy' : 'healthy',
    { latencyMs: metrics.conversationLatencyMs },
  )
  const search = panel(
    'search',
    'Search',
    'healthy',
    { latencyMs: metrics.searchLatencyMs },
  )
  const recommendation = panel(
    'recommendation',
    'Recommendation',
    'healthy',
    { status: 'available' },
  )
  const booking = panel(
    'booking',
    'Booking',
    monitoring.bookingFailureCount >= 5 ? 'degraded' : 'healthy',
    {
      latencyMs: metrics.bookingLatencyMs,
      failures: monitoring.bookingFailureCount,
    },
  )
  const trips = panel(
    'trips',
    'Trips',
    byId('trip')?.status === 'unhealthy' ? 'unhealthy' : 'healthy',
    { latencyMs: metrics.tripLatencyMs },
  )
  const documents = panel(
    'documents',
    'Documents',
    'healthy',
    { latencyMs: metrics.documentLatencyMs },
  )
  const paymentsPanel = panel(
    'payments',
    'Payments',
    payments.some((p) => p.status === 'unhealthy')
      ? 'unhealthy'
      : payments.some((p) => p.status === 'degraded')
        ? 'degraded'
        : 'healthy',
    {
      mockFailures: monitoring.paymentMockFailureCount,
      gateways: payments.length,
    },
  )
  const providersPanel = panel(
    'providers',
    'Providers',
    providers.overall === 'healthy' ? 'healthy' : providers.overall,
    {
      count: providers.providers.length,
      latencyMs: metrics.providerLatencyMs,
      failures: monitoring.providerFailureCount,
    },
  )
  const notificationsPanel = panel(
    'notifications',
    'Notifications',
    notifications.some((n) => n.queueHealth === 'unhealthy')
      ? 'unhealthy'
      : notifications.some((n) => n.queueHealth === 'degraded')
        ? 'degraded'
        : 'healthy',
    {
      channels: notifications.length,
      failures: monitoring.notificationFailureCount,
    },
  )
  const system = panel(
    'system',
    'System',
    health.overall === 'healthy' ? 'healthy' : health.overall,
    {
      liveness: health.liveness,
      readiness: health.readiness,
      health: health.health,
      errorRate: metrics.errorRate,
      memoryPressure: metrics.memoryPressure,
    },
  )

  const panels = [
    conversation,
    search,
    recommendation,
    booking,
    trips,
    documents,
    paymentsPanel,
    providersPanel,
    notificationsPanel,
    system,
  ]
  const overall: ProductionOpsDashboard['overall'] = panels.some((p) => p.status === 'unhealthy')
    ? 'unhealthy'
    : panels.some((p) => p.status === 'degraded')
      ? 'degraded'
      : 'healthy'

  return {
    conversation,
    search,
    recommendation,
    booking,
    trips,
    documents,
    payments: paymentsPanel,
    providers: providersPanel,
    notifications: notificationsPanel,
    system,
    overall,
    generatedAt: new Date().toISOString(),
  }
}
