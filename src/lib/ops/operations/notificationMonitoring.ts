/**
 * Sprint 69 — Notification monitoring (email / WhatsApp / push / SMS).
 */

import {
  buildBetaNotificationMatrix,
  createProductionNotificationLayer,
} from '../beta'
import { getOpsMetrics } from '../observability/metricsRegistry'
import { getDeadLetterQueue } from '../reliability/deadLetter'
import type { NotificationMonitorMetrics } from './types'

function counterSum(includes: string): number {
  const snap = getOpsMetrics().snapshot()
  return Object.entries(snap.counters)
    .filter(([k]) => k.includes(includes))
    .reduce((sum, [, v]) => sum + v, 0)
}

export function collectNotificationMonitorMetrics(): NotificationMonitorMetrics[] {
  const matrix = buildBetaNotificationMatrix()
  const layer = createProductionNotificationLayer()
  const history = layer.getDeliveryHistory()
  const notifFailures = counterSum('notification.failures')
  const retries = counterSum('ops.retries')
  const dlqSize = getDeadLetterQueue().list().length
  const queueSize = dlqSize

  return matrix.map((slot) => {
    const channelHistory = history.filter((h) => h.channel === slot.channel)
    const sent = channelHistory.filter((h) => h.success).length
    const failed = channelHistory.filter((h) => !h.success).length + (slot.channel === 'email' ? notifFailures : 0)
    const channelRetries = channelHistory.filter((h) => h.attempt > 1).length + retries
    const total = Math.max(1, sent + failed)
    const deliveryRate = sent / total
    const retryRate = channelRetries / total
    const queueHealth: NotificationMonitorMetrics['queueHealth'] =
      queueSize >= 25 ? 'unhealthy' : queueSize >= 5 || failed >= 3 ? 'degraded' : 'healthy'

    return {
      channel: slot.channel,
      deliveryRate,
      retryRate,
      queueHealth,
      sent,
      failed,
      retries: channelRetries,
    }
  })
}
