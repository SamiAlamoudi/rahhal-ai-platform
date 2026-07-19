/**
 * Sprint 34 — RefundEngine (full / partial / cancellation / failed-payment rollback).
 */

import { PaymentPlatformError } from './PaymentErrors'
import type { PaymentAudit } from './PaymentAudit'
import type { PaymentEvents } from './PaymentEvents'
import { createPaymentEvent } from './PaymentEvents'
import type { PaymentMetrics } from './PaymentMetrics'
import type { PaymentProviderRegistry } from './PaymentProviderRegistry'
import type { PaymentSessionStore } from './PaymentSession'
import type {
  PlatformPaymentSession,
  RefundInput,
  RefundKind,
} from './types'

export interface RefundOutcome {
  success: boolean
  session: PlatformPaymentSession
  refundId: string | null
  refundedAmount: number
  kind: RefundKind
  message: string
}

export class RefundEngine {
  private readonly sessions: PaymentSessionStore
  private readonly registry: PaymentProviderRegistry
  private readonly events: PaymentEvents
  private readonly audit: PaymentAudit
  private readonly metrics: PaymentMetrics

  constructor(
    sessions: PaymentSessionStore,
    registry: PaymentProviderRegistry,
    events: PaymentEvents,
    audit: PaymentAudit,
    metrics: PaymentMetrics,
  ) {
    this.sessions = sessions
    this.registry = registry
    this.events = events
    this.audit = audit
    this.metrics = metrics
  }

  async refund(sessionId: string, input: RefundInput): Promise<RefundOutcome> {
    const session = this.sessions.get(sessionId)

    if (input.kind === 'failed_payment_rollback') {
      return this.rollbackUnpaid(session, input.reason ?? 'failed_payment_rollback')
    }

    if (!session.providerChargeId || !session.providerId) {
      throw new PaymentPlatformError(
        'REFUND_FAILED',
        'No captured charge available to refund',
      )
    }

    if (!['PAID', 'BOOKING_CONFIRMED', 'INVOICED', 'COMPLETED', 'PARTIALLY_REFUNDED'].includes(session.state)) {
      throw new PaymentPlatformError(
        'INVALID_STATE',
        `Cannot refund session in state ${session.state}`,
      )
    }

    const remaining = session.pricing.total - session.refundedAmount
    let amount = remaining
    if (input.kind === 'partial') {
      if (input.amount == null || input.amount <= 0) {
        throw new PaymentPlatformError('VALIDATION_FAILED', 'Partial refund requires amount')
      }
      amount = Math.min(remaining, input.amount)
    }
    if (input.kind === 'cancellation') {
      amount = remaining
    }
    if (input.kind === 'full') {
      amount = remaining
    }
    if (amount <= 0) {
      throw new PaymentPlatformError('REFUND_FAILED', 'Nothing left to refund')
    }

    this.events.emit(createPaymentEvent('RefundStarted', sessionId, {
      kind: input.kind,
      amount,
    }))
    this.audit.record(sessionId, 'refund.started', session.state, {
      kind: input.kind,
      amount,
    })

    const provider = this.registry.get(session.providerId)
    if (!provider) {
      throw new PaymentPlatformError('PROVIDER_UNAVAILABLE', `Provider ${session.providerId} missing`)
    }

    const result = await provider.refund({
      chargeId: session.providerChargeId,
      amount,
      currency: session.pricing.currency,
      reason: input.reason ?? input.kind,
    })

    if (!result.success || !result.refundId) {
      throw new PaymentPlatformError('REFUND_FAILED', result.message)
    }

    const refundedAmount = session.refundedAmount + result.refundedAmount
    const fullyRefunded = refundedAmount >= session.pricing.total - 0.001
    const nextState = fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED'

    const updated = this.sessions.update(sessionId, {
      state: nextState,
      refundedAmount,
      refundIds: [...session.refundIds, result.refundId],
      inventory: session.inventory
        ? {
            ...session.inventory,
            status: fullyRefunded ? 'released' : session.inventory.status,
            releasedAt: fullyRefunded
              ? new Date().toISOString()
              : session.inventory.releasedAt,
          }
        : null,
    })

    this.metrics.recordRefund()
    this.events.emit(createPaymentEvent('RefundCompleted', sessionId, {
      refundId: result.refundId,
      refundedAmount: result.refundedAmount,
      kind: input.kind,
    }))
    this.audit.record(sessionId, 'refund.completed', nextState, {
      refundId: result.refundId,
      refundedAmount: result.refundedAmount,
      kind: input.kind,
    })

    return {
      success: true,
      session: updated,
      refundId: result.refundId,
      refundedAmount: result.refundedAmount,
      kind: input.kind,
      message: result.message,
    }
  }

  private async rollbackUnpaid(
    session: PlatformPaymentSession,
    reason: string,
  ): Promise<RefundOutcome> {
    this.events.emit(createPaymentEvent('RollbackStarted', session.sessionId, { reason }))
    this.audit.record(session.sessionId, 'rollback.started', session.state, { reason })
    this.metrics.recordRollback()

    const updated = this.sessions.update(session.sessionId, {
      state: 'ROLLED_BACK',
      error: reason,
      inventory: session.inventory
        ? {
            ...session.inventory,
            status: 'released',
            releasedAt: new Date().toISOString(),
          }
        : null,
      intent: {
        ...session.intent,
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      },
      completedAt: new Date().toISOString(),
    })

    this.events.emit(createPaymentEvent('RollbackCompleted', session.sessionId, { reason }))
    this.audit.record(session.sessionId, 'rollback.completed', 'ROLLED_BACK', { reason })

    return {
      success: true,
      session: updated,
      refundId: null,
      refundedAmount: 0,
      kind: 'failed_payment_rollback',
      message: 'Inventory released and payment rolled back',
    }
  }
}
