/**
 * Sprint 36 — Policy-case RefundStatusTracker.
 * Distinct from trips/RefundStatusTracker (post-booking record fields).
 * Tracks PolicyRefundCase FSM; payment money movement stays in Sprint 34.
 */

import type { PolicyCaseStatus, PolicyQuote, PolicyRefundCase, TripPolicyLifecycle } from './types'

export class RefundStatusTracker {
  private readonly cases = new Map<string, PolicyRefundCase>()

  create(input: {
    tripId: string
    userId: string
    quote: PolicyQuote
    paymentSessionId?: string | null
  }): PolicyRefundCase {
    const now = new Date().toISOString()
    const record: PolicyRefundCase = {
      caseId: `rcase_${Math.random().toString(36).slice(2, 10)}`,
      tripId: input.tripId,
      userId: input.userId,
      status: 'quoted',
      quote: input.quote,
      tripLifecycle: 'Upcoming',
      paymentSessionId: input.paymentSessionId ?? null,
      paymentRefundId: null,
      refundedAmount: 0,
      error: null,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    }
    this.cases.set(record.caseId, clone(record))
    return clone(record)
  }

  get(caseId: string): PolicyRefundCase | null {
    const row = this.cases.get(caseId)
    return row ? clone(row) : null
  }

  listByTrip(tripId: string): PolicyRefundCase[] {
    return [...this.cases.values()]
      .filter((c) => c.tripId === tripId)
      .map(clone)
  }

  transition(
    caseId: string,
    status: PolicyCaseStatus,
    patch?: Partial<Pick<
      PolicyRefundCase,
      'paymentRefundId' | 'refundedAmount' | 'error' | 'tripLifecycle' | 'retryCount'
    >>,
  ): PolicyRefundCase {
    const current = this.cases.get(caseId)
    if (!current) throw new Error(`Refund case ${caseId} not found`)

    const lifecycle = patch?.tripLifecycle ?? lifecycleFromStatus(status, current.tripLifecycle)
    const next: PolicyRefundCase = {
      ...current,
      ...patch,
      status,
      tripLifecycle: lifecycle,
      updatedAt: new Date().toISOString(),
      completedAt:
        status === 'refund_completed' || status === 'cancelled'
          ? new Date().toISOString()
          : current.completedAt,
    }
    this.cases.set(caseId, next)
    return clone(next)
  }

  clear(): void {
    this.cases.clear()
  }
}

export function lifecycleFromStatus(
  status: PolicyCaseStatus,
  fallback: TripPolicyLifecycle,
): TripPolicyLifecycle {
  switch (status) {
    case 'cancelling':
    case 'cancelled':
      return status === 'cancelling' ? 'Modified' : 'Cancelled'
    case 'refund_pending':
    case 'refund_approved':
      return 'Refund Pending'
    case 'refund_completed':
      return 'Refund Completed'
    case 'quoted':
    case 'validated':
      return 'Modified'
    default:
      return fallback
  }
}

function clone(record: PolicyRefundCase): PolicyRefundCase {
  return {
    ...record,
    quote: {
      ...record.quote,
      policies: record.quote.policies.map((p) => ({
        ...p,
        specialConditions: [...p.specialConditions],
        providerNotes: [...p.providerNotes],
        attributes: { ...p.attributes },
      })),
      breakdown: {
        ...record.quote.breakdown,
        lines: record.quote.breakdown.lines.map((l) => ({
          ...l,
          notes: [...l.notes],
        })),
        explanation: [...record.quote.breakdown.explanation],
      },
      validationMessages: [...record.quote.validationMessages],
    },
  }
}

export function createPolicyRefundStatusTracker(): RefundStatusTracker {
  return new RefundStatusTracker()
}
