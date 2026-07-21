/**
 * Sprint 69 — Payment monitoring (Stripe / HyperPay / Apple Pay / mock).
 */

import {
  buildBetaPaymentMatrix,
  getBetaEnvironmentProfile,
  resolveBetaEnvironment,
} from '../beta'
import { getOpsMetrics } from '../observability/metricsRegistry'
import type { OpsEnvironment, PaymentMonitorMetrics } from './types'

function counterSum(includes: string): number {
  const snap = getOpsMetrics().snapshot()
  return Object.entries(snap.counters)
    .filter(([k]) => k.includes(includes))
    .reduce((sum, [, v]) => sum + v, 0)
}

export function collectPaymentMonitorMetrics(
  environment: OpsEnvironment = 'beta',
): PaymentMonitorMetrics[] {
  const profile = getBetaEnvironmentProfile(resolveBetaEnvironment(environment as 'beta'))
  const matrix = buildBetaPaymentMatrix(profile)
  const failures = counterSum('payment.mock_failures') + counterSum('payment')
  const retries = counterSum('ops.retries')
  const timeouts = counterSum('ops.timeouts')

  return matrix
    .filter((s) => ['mock', 'stripe', 'hyperpay', 'apple_pay'].includes(s.gatewayId))
    .map((slot) => {
      const isMock = slot.mode === 'mock' || slot.gatewayId === 'mock'
      const failure = isMock ? failures : 0
      const success = Math.max(0, 10 - failure)
      let status: PaymentMonitorMetrics['status'] = 'idle'
      if (slot.mode === 'mock' || slot.mode === 'sandbox') {
        status = failure >= 5 ? 'degraded' : 'healthy'
      } else if (slot.mode === 'future') {
        status = 'idle'
      } else {
        status = failure >= 3 ? 'unhealthy' : 'healthy'
      }

      return {
        providerId: slot.gatewayId,
        mode: slot.mode,
        success,
        failure,
        timeout: isMock ? timeouts : 0,
        retries: isMock ? retries : 0,
        refundPathReady: slot.gatewayId === 'mock' || slot.mode === 'sandbox',
        status,
      }
    })
}
