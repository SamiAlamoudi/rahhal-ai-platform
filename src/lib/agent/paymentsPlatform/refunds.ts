/**
 * Refund Engine — Sprint 58.
 * Full/partial refunds, provider cancellation, tracking, timeline.
 */

import { isRefundsEnabled } from './feature'
import type { PaymentProviderRegistry } from './providers'
import type {
  PaymentLifecycleStatus,
  PaymentSession,
  RefundRecord,
} from './types'

export class RefundEngine {
  private readonly refunds = new Map<string, RefundRecord>()
  private readonly providers: PaymentProviderRegistry

  constructor(providers: PaymentProviderRegistry) {
    this.providers = providers
  }

  list(paymentSessionId?: string): RefundRecord[] {
    const all = [...this.refunds.values()]
    if (!paymentSessionId) return all
    return all.filter((r) => r.paymentSessionId === paymentSessionId)
  }

  get(id: string): RefundRecord | undefined {
    return this.refunds.get(id)
  }

  async startRefund(input: {
    session: PaymentSession
    amount?: number
    providerCancellation?: boolean
    reason?: string
    enabled?: boolean
    now?: () => number
  }): Promise<RefundRecord> {
    if (!isRefundsEnabled({ enabled: input.enabled })) {
      throw new Error('refunds_disabled')
    }
    if (!input.session.providerRef || !input.session.providerId) {
      throw new Error('missing_provider_ref')
    }
    const now = input.now ?? (() => Date.now())
    const amount = input.amount ?? input.session.capturedAmount
    if (amount <= 0 || amount > input.session.capturedAmount) {
      throw new Error('invalid_refund_amount')
    }
    const kind = amount >= input.session.capturedAmount ? 'full' : 'partial'
    const id = `ref_${Math.random().toString(36).slice(2, 10)}`
    const at = new Date(now()).toISOString()
    const record: RefundRecord = {
      id,
      paymentSessionId: input.session.id,
      kind,
      amount,
      currency: input.session.currency,
      status: 'refund_pending',
      providerCancellation: Boolean(input.providerCancellation),
      timeline: [{ at, status: 'refund_pending', note: input.reason ?? 'refund_started' }],
      refundRef: null,
      createdAt: at,
      updatedAt: at,
    }
    this.refunds.set(id, record)

    const adapter = this.providers.get(input.session.method)
    if (!adapter) {
      return this.fail(record, 'provider_unavailable', now)
    }
    const result = await adapter.refund({
      providerRef: input.session.providerRef,
      amount,
      currency: input.session.currency,
      reason: input.reason,
    })
    if (!result.ok) {
      return this.fail(record, result.error || 'refund_failed', now)
    }
    const completed: RefundRecord = {
      ...record,
      status: 'refunded',
      refundRef: result.refundRef,
      updatedAt: new Date(now()).toISOString(),
      timeline: [
        ...record.timeline,
        {
          at: new Date(now()).toISOString(),
          status: 'refunded',
          note: input.providerCancellation ? 'provider_cancellation' : 'refund_completed',
        },
      ],
    }
    this.refunds.set(id, completed)
    return completed
  }

  private fail(
    record: RefundRecord,
    note: string,
    now: () => number,
  ): RefundRecord {
    const next: RefundRecord = {
      ...record,
      status: 'failed',
      updatedAt: new Date(now()).toISOString(),
      timeline: [
        ...record.timeline,
        { at: new Date(now()).toISOString(), status: 'failed' as PaymentLifecycleStatus, note },
      ],
    }
    this.refunds.set(record.id, next)
    return next
  }

  clear(): void {
    this.refunds.clear()
  }
}
