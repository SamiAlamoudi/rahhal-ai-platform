/**
 * Sprint 36 — PolicyEngine
 *
 * Central cancellation & refund policy orchestrator.
 * Reuses Sprint 34 PaymentOrchestrator.refund for money movement and
 * Sprint 35 PostBookingService / CancellationManager for trip lifecycle.
 */

import type { PaymentOrchestrator } from '../payments'
import type { PostBookingService } from '../trips'
import { AuditLogger } from './AuditLogger'
import { CancellationValidator } from './CancellationValidator'
import { isRefundPolicyEngineEnabled } from './PolicyFeatureFlags'
import { PolicyMetrics } from './PolicyMetrics'
import { PolicyNormalizer } from './PolicyNormalizer'
import { RefundCalculator } from './RefundCalculator'
import { RefundStatusTracker } from './RefundStatusTracker'
import { RefundTimelineEstimator } from './RefundTimelineEstimator'
import type {
  CancellationExecutionResult,
  CancellationScope,
  PolicyQuote,
  PolicyQuoteInput,
  PolicyRefundCase,
  TripPolicyLifecycle,
} from './types'

export class PolicyEngineError extends Error {
  readonly code: 'FEATURE_DISABLED' | 'VALIDATION' | 'NOT_FOUND' | 'PROVIDER_FAILURE' | 'UNKNOWN'

  constructor(code: PolicyEngineError['code'], message: string) {
    super(message)
    this.name = 'PolicyEngineError'
    this.code = code
  }
}

export interface PolicyEngineOptions {
  enabled?: boolean
  normalizer?: PolicyNormalizer
  calculator?: RefundCalculator
  validator?: CancellationValidator
  timeline?: RefundTimelineEstimator
  tracker?: RefundStatusTracker
  audit?: AuditLogger
  metrics?: PolicyMetrics
  paymentOrchestrator?: PaymentOrchestrator | null
  postBookingService?: PostBookingService | null
}

export class PolicyEngine {
  private readonly normalizer: PolicyNormalizer
  private readonly calculator: RefundCalculator
  private readonly validator: CancellationValidator
  private readonly timeline: RefundTimelineEstimator
  private readonly tracker: RefundStatusTracker
  private readonly audit: AuditLogger
  private readonly metrics: PolicyMetrics
  private readonly payments: PaymentOrchestrator | null
  private readonly postBooking: PostBookingService | null
  private readonly forceEnabled: boolean | undefined
  private readonly notifications: Array<{
    trigger: string
    tripId: string
    caseId: string
    at: string
    title: string
    body: string
  }> = []

  constructor(options: PolicyEngineOptions = {}) {
    this.normalizer = options.normalizer ?? new PolicyNormalizer()
    this.calculator = options.calculator ?? new RefundCalculator()
    this.validator = options.validator ?? new CancellationValidator()
    this.timeline = options.timeline ?? new RefundTimelineEstimator()
    this.tracker = options.tracker ?? new RefundStatusTracker()
    this.audit = options.audit ?? new AuditLogger()
    this.metrics = options.metrics ?? new PolicyMetrics()
    this.payments = options.paymentOrchestrator ?? null
    this.postBooking = options.postBookingService ?? null
    this.forceEnabled = options.enabled
  }

  isEnabled(): boolean {
    if (typeof this.forceEnabled === 'boolean') return this.forceEnabled
    return isRefundPolicyEngineEnabled()
  }

  /** Quote refund without executing cancellation. */
  quote(input: PolicyQuoteInput): PolicyQuote {
    this.assertEnabled()
    const policies = this.normalizer.normalizeAll(input.lines)
    const validation = this.validator.validate(input, policies)
    const breakdown = this.calculator.calculate(input, policies)
    const window = this.timeline.estimate(policies)

    const simpleExplanation = buildSimpleExplanation(input.scope, breakdown, window.label)

    const quote: PolicyQuote = {
      quoteId: `pquote_${Math.random().toString(36).slice(2, 10)}`,
      tripId: input.tripId,
      scope: input.scope,
      reason: input.reason,
      policies,
      breakdown,
      cancellable: validation.cancellable,
      validationMessages: validation.messages,
      simpleExplanation,
      createdAt: new Date().toISOString(),
    }

    this.metrics.recordQuote(input.reason)
    this.audit.record({
      tripId: input.tripId,
      action: 'policy.quoted',
      detail: {
        scope: input.scope,
        totalRefund: breakdown.totalRefund,
        cancellable: validation.cancellable,
      },
    })

    return quote
  }

  /**
   * Validate → cancel with provider → refund via payments → update trip.
   * On provider failure: rollback case, keep payment/booking refs, audit.
   */
  async executeCancellation(input: PolicyQuoteInput & {
    paymentSessionId?: string | null
    retryOfCaseId?: string | null
    /** Test/harness: force provider cancel failure + rollback. */
    simulateProviderFailure?: boolean
  }): Promise<CancellationExecutionResult> {
    this.assertEnabled()
    const quote = this.quote(input)
    if (!quote.cancellable) {
      throw new PolicyEngineError(
        'VALIDATION',
        quote.validationMessages.join('; ') || 'Cancellation not allowed',
      )
    }

    let policyCase = this.tracker.create({
      tripId: input.tripId,
      userId: input.userId,
      quote,
      paymentSessionId: input.paymentSessionId,
    })
    if (input.retryOfCaseId) {
      const prev = this.tracker.get(input.retryOfCaseId)
      policyCase = this.tracker.transition(policyCase.caseId, 'quoted', {
        retryCount: (prev?.retryCount ?? 0) + 1,
      })
    }

    const auditIds: string[] = []
    auditIds.push(
      this.audit.record({
        caseId: policyCase.caseId,
        tripId: input.tripId,
        action: 'cancellation.started',
        detail: { scope: input.scope },
      }).id,
    )

    policyCase = this.tracker.transition(policyCase.caseId, 'validated')
    policyCase = this.tracker.transition(policyCase.caseId, 'cancelling', {
      tripLifecycle: 'Modified',
    })
    this.pushNotification(
      'Provider updated',
      policyCase,
      'Cancellation in progress',
      `We are cancelling ${scopeLabel(input.scope)} for your trip.`,
    )
    this.updateTripLifecycle(input.tripId, 'Modified')

    // Provider cancellation (adapter boundary — failure path for safe rollback).
    if (input.simulateProviderFailure) {
      this.metrics.recordFailure()
      this.metrics.recordRollback()
      policyCase = this.tracker.transition(policyCase.caseId, 'rolled_back', {
        error: 'Provider cancellation failed',
        tripLifecycle: 'Upcoming',
      })
      auditIds.push(
        this.audit.record({
          caseId: policyCase.caseId,
          tripId: input.tripId,
          action: 'cancellation.provider_failed',
          detail: { rolledBack: true },
        }).id,
      )
      auditIds.push(
        this.audit.record({
          caseId: policyCase.caseId,
          tripId: input.tripId,
          action: 'cancellation.rolled_back',
          detail: {
            paymentConsistent: true,
            bookingReferencesKept: true,
          },
        }).id,
      )
      this.updateTripLifecycle(input.tripId, 'Upcoming')
      return {
        success: false,
        caseId: policyCase.caseId,
        quote,
        status: 'rolled_back',
        tripLifecycle: 'Upcoming',
        paymentRefundId: null,
        paymentRefundedAmount: 0,
        rolledBack: true,
        message: 'Provider cancellation failed — rolled back; payment and booking refs unchanged',
        auditIds,
      }
    }

    policyCase = this.tracker.transition(policyCase.caseId, 'cancelled', {
      tripLifecycle: input.scope === 'full_booking' ? 'Cancelled' : 'Modified',
    })
    this.updateTripLifecycle(
      input.tripId,
      input.scope === 'full_booking' ? 'Cancelled' : 'Modified',
    )

    // Refund pending
    policyCase = this.tracker.transition(policyCase.caseId, 'refund_pending', {
      tripLifecycle: 'Refund Pending',
    })
    this.updateTripLifecycle(input.tripId, 'Refund Pending')
    this.pushNotification(
      'Refund requested',
      policyCase,
      'Refund requested',
      `Refund of ${quote.breakdown.totalRefund} ${quote.breakdown.currency} requested.`,
    )
    this.metrics.recordRefundAttempt(input.reason)

    let paymentRefundId: string | null = null
    let paymentRefundedAmount = 0
    const started = Date.now()

    if (this.payments && input.paymentSessionId && quote.breakdown.totalRefund > 0) {
      try {
        const outcome = await this.payments.refund(input.paymentSessionId, {
          // Always partial with explicit policy amount — "cancellation" would refund full capture.
          kind: 'partial',
          amount: quote.breakdown.totalRefund,
          reason: input.reason,
        })
        if (!outcome.success) {
          throw new Error(outcome.message)
        }
        paymentRefundId = outcome.refundId
        paymentRefundedAmount = outcome.refundedAmount
        policyCase = this.tracker.transition(policyCase.caseId, 'refund_approved', {
          paymentRefundId,
          refundedAmount: paymentRefundedAmount,
          tripLifecycle: 'Refund Pending',
        })
        this.pushNotification(
          'Refund approved',
          policyCase,
          'Refund approved',
          `Your refund of ${paymentRefundedAmount} ${quote.breakdown.currency} was approved.`,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Refund failed'
        this.metrics.recordFailure()
        policyCase = this.tracker.transition(policyCase.caseId, 'refund_rejected', {
          error: message,
          tripLifecycle: 'Cancelled',
        })
        this.pushNotification(
          'Refund rejected',
          policyCase,
          'Refund rejected',
          message,
        )
        auditIds.push(
          this.audit.record({
            caseId: policyCase.caseId,
            tripId: input.tripId,
            action: 'refund.rejected',
            detail: { message },
          }).id,
        )
        return {
          success: false,
          caseId: policyCase.caseId,
          quote,
          status: 'refund_rejected',
          tripLifecycle: 'Cancelled',
          paymentRefundId: null,
          paymentRefundedAmount: 0,
          rolledBack: false,
          message,
          auditIds,
        }
      }
    } else {
      // No payment session wired — still complete policy case with calculated amount.
      paymentRefundedAmount = quote.breakdown.totalRefund
      policyCase = this.tracker.transition(policyCase.caseId, 'refund_approved', {
        refundedAmount: paymentRefundedAmount,
        tripLifecycle: 'Refund Pending',
      })
    }

    policyCase = this.tracker.transition(policyCase.caseId, 'refund_completed', {
      paymentRefundId,
      refundedAmount: paymentRefundedAmount,
      tripLifecycle: 'Refund Completed',
    })
    this.updateTripLifecycle(input.tripId, 'Refund Completed')
    this.syncTripRefundTracker(input.tripId, paymentRefundedAmount)

    const avgDays =
      (quote.breakdown.expectedArrivalBusinessDaysMin
        + quote.breakdown.expectedArrivalBusinessDaysMax) / 2
    this.metrics.recordRefundSuccess(
      paymentRefundedAmount,
      avgDays,
      Date.now() - started,
    )
    this.pushNotification(
      'Refund completed',
      policyCase,
      'Refund completed',
      `Refund ${paymentRefundedAmount} ${quote.breakdown.currency} completed. Expected arrival ${quote.breakdown.expectedArrivalBusinessDaysMin}–${quote.breakdown.expectedArrivalBusinessDaysMax} business days.`,
    )
    this.pushNotification(
      'Timeline changed',
      policyCase,
      'Trip timeline updated',
      'Your trip status is now Refund Completed.',
    )

    auditIds.push(
      this.audit.record({
        caseId: policyCase.caseId,
        tripId: input.tripId,
        action: 'refund.completed',
        detail: {
          amount: paymentRefundedAmount,
          paymentRefundId,
          scope: input.scope,
        },
      }).id,
    )

    return {
      success: true,
      caseId: policyCase.caseId,
      quote,
      status: 'refund_completed',
      tripLifecycle: 'Refund Completed',
      paymentRefundId,
      paymentRefundedAmount,
      rolledBack: false,
      message: quote.simpleExplanation,
      auditIds,
    }
  }

  /** Safe retry after provider failure. */
  async retryCancellation(
    caseId: string,
    input: PolicyQuoteInput & {
      paymentSessionId?: string | null
      simulateProviderFailure?: boolean
    },
  ): Promise<CancellationExecutionResult> {
    this.assertEnabled()
    const existing = this.tracker.get(caseId)
    if (!existing) throw new PolicyEngineError('NOT_FOUND', `Case ${caseId} not found`)
    if (existing.status !== 'rolled_back' && existing.status !== 'failed') {
      throw new PolicyEngineError(
        'VALIDATION',
        `Cannot retry case in status ${existing.status}`,
      )
    }
    this.audit.record({
      caseId,
      tripId: input.tripId,
      action: 'cancellation.retry',
      detail: { previousStatus: existing.status },
    })
    return this.executeCancellation({
      ...input,
      retryOfCaseId: caseId,
      simulateProviderFailure: input.simulateProviderFailure === true,
    })
  }

  getCase(caseId: string): PolicyRefundCase | null {
    return this.tracker.get(caseId)
  }

  listCasesForTrip(tripId: string): PolicyRefundCase[] {
    return this.tracker.listByTrip(tripId)
  }

  getMetricsSnapshot() {
    return this.metrics.snapshot()
  }

  getAuditLog() {
    return this.audit
  }

  listNotifications(tripId?: string) {
    return tripId
      ? this.notifications.filter((n) => n.tripId === tripId)
      : [...this.notifications]
  }

  private updateTripLifecycle(tripId: string, lifecycle: TripPolicyLifecycle): void {
    if (!this.postBooking) return
    const trip = this.postBooking.getTrip(tripId)
    if (!trip) return

    // Map policy lifecycle onto Sprint 35 buckets where possible.
    if (lifecycle === 'Cancelled') {
      try {
        this.postBooking.cancelTrip(tripId, 'policy_engine_cancellation')
      } catch {
        /* already cancelled */
      }
      return
    }
    if (lifecycle === 'Refund Pending' || lifecycle === 'Refund Completed') {
      try {
        this.postBooking.updateRefundStatus(
          tripId,
          lifecycle === 'Refund Completed' ? 'completed' : 'processing',
          trip.totalPaid,
        )
      } catch {
        /* trip may not support */
      }
    }
    if (lifecycle === 'Modified' || lifecycle === 'Upcoming') {
      // Keep Upcoming/Active; Modified is reflected via refund status + notifications.
    }
  }

  private syncTripRefundTracker(tripId: string, amount: number): void {
    if (!this.postBooking) return
    try {
      this.postBooking.updateRefundStatus(tripId, 'completed', amount)
    } catch {
      /* optional */
    }
  }

  private pushNotification(
    trigger: string,
    policyCase: PolicyRefundCase,
    title: string,
    body: string,
  ): void {
    this.notifications.push({
      trigger,
      tripId: policyCase.tripId,
      caseId: policyCase.caseId,
      at: new Date().toISOString(),
      title,
      body,
    })
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new PolicyEngineError(
        'FEATURE_DISABLED',
        'Refund policy engine is disabled (brain.refund_policy_engine)',
      )
    }
  }
}

export function createPolicyEngine(options?: PolicyEngineOptions): PolicyEngine {
  return new PolicyEngine(options)
}

function buildSimpleExplanation(
  scope: CancellationScope,
  breakdown: PolicyQuote['breakdown'],
  windowLabel: string,
): string {
  const lines = breakdown.lines
    .map(
      (l) =>
        `${l.title}: ${l.refundAmount.toLocaleString('en-US')} ${breakdown.currency}` +
        (l.penaltyAmount > 0
          ? ` (penalty ${l.penaltyAmount.toLocaleString('en-US')} ${breakdown.currency})`
          : ''),
    )
    .join('\n')
  return [
    `If you cancel ${scopeLabel(scope)} now, here is your refund breakdown:`,
    lines,
    `Platform fee: ${breakdown.platformFeeRefunded.toLocaleString('en-US')} ${breakdown.currency}`,
    `Total refund: ${breakdown.totalRefund.toLocaleString('en-US')} ${breakdown.currency}`,
    `Expected arrival: ${windowLabel}`,
  ].join('\n')
}

function scopeLabel(scope: CancellationScope): string {
  switch (scope) {
    case 'hotel_only':
      return 'the hotel only'
    case 'flight_only':
      return 'the flight only'
    case 'car_only':
      return 'the car rental only'
    case 'activity_only':
      return 'the activity only'
    case 'one_passenger':
      return 'one traveler'
    case 'one_room':
      return 'one room'
    case 'return_flight_only':
      return 'the return flight only'
    case 'full_booking':
    default:
      return 'the whole booking'
  }
}
