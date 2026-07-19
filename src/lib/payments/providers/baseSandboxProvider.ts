/**
 * Sprint 34 — shared sandbox charge/refund behavior for payment adapters.
 */

import type {
  PlatformPaymentProvider,
  PlatformPaymentProviderId,
  ProviderChargeRequest,
  ProviderChargeResult,
  ProviderHealth,
  ProviderRefundRequest,
  ProviderRefundResult,
} from '../types'

export interface SandboxProviderOptions {
  id: PlatformPaymentProviderId
  displayName: string
  priority: number
  /** When true, healthCheck reports unhealthy (for failover tests). */
  unhealthy?: boolean
  /** Extra artificial latency. */
  delayMs?: number
}

export function createSandboxPaymentProvider(
  options: SandboxProviderOptions,
): PlatformPaymentProvider {
  const charges = new Map<string, { amount: number; currency: string; refunded: number }>()

  return {
    id: options.id,
    displayName: options.displayName,
    priority: options.priority,

    async charge(request: ProviderChargeRequest): Promise<ProviderChargeResult> {
      const started = Date.now()
      if (options.delayMs) await sleep(options.delayMs)

      const simulate = request.simulate ?? 'success'
      if (simulate === 'timeout') {
        return {
          success: false,
          providerId: options.id,
          chargeId: null,
          status: 'timeout',
          latencyMs: Date.now() - started,
          message: `${options.displayName} payment timed out`,
          authorizationCode: null,
        }
      }
      if (simulate === 'declined') {
        return {
          success: false,
          providerId: options.id,
          chargeId: null,
          status: 'declined',
          latencyMs: Date.now() - started,
          message: `${options.displayName} declined the payment`,
          authorizationCode: null,
        }
      }

      const chargeId = `${options.id.toUpperCase()}-CHG-${tail()}`
      charges.set(chargeId, {
        amount: request.amount,
        currency: request.currency,
        refunded: 0,
      })

      return {
        success: true,
        providerId: options.id,
        chargeId,
        status: 'captured',
        latencyMs: Date.now() - started,
        message: `${options.displayName} captured payment`,
        authorizationCode: `AUTH-${tail()}`,
      }
    },

    async refund(request: ProviderRefundRequest): Promise<ProviderRefundResult> {
      const started = Date.now()
      const existing = charges.get(request.chargeId)
      if (!existing) {
        return {
          success: false,
          refundId: null,
          refundedAmount: 0,
          message: 'Charge not found',
          latencyMs: Date.now() - started,
        }
      }
      const remaining = existing.amount - existing.refunded
      const amount = Math.min(remaining, request.amount)
      if (amount <= 0) {
        return {
          success: false,
          refundId: null,
          refundedAmount: 0,
          message: 'Nothing left to refund',
          latencyMs: Date.now() - started,
        }
      }
      existing.refunded += amount
      return {
        success: true,
        refundId: `${options.id.toUpperCase()}-RFND-${tail()}`,
        refundedAmount: amount,
        message: 'Refund processed',
        latencyMs: Date.now() - started,
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const started = Date.now()
      if (options.delayMs) await sleep(Math.min(options.delayMs, 5))
      return {
        providerId: options.id,
        healthy: !options.unhealthy,
        latencyMs: Date.now() - started,
        message: options.unhealthy ? 'Provider unhealthy' : 'OK',
      }
    },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function tail(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}
