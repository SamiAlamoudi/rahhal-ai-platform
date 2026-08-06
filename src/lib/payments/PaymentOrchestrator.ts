/**
 * Sprint 34 — PaymentOrchestrator
 *
 * Workflow: TravelExecutionEngine → intent → reserve inventory → pay → verify →
 * confirm booking → references → invoice → events → audit.
 *
 * Distinct from src/lib/payment/orchestration/PaymentOrchestrator (hosted checkout FSM).
 * Does not duplicate planning, provider search, or booking UI logic.
 */

import type { ExecutionResult } from '../execution'
import { PaymentAudit } from './PaymentAudit'
import { PaymentPlatformError } from './PaymentErrors'
import { PaymentEvents, createPaymentEvent, type PaymentEvent } from './PaymentEvents'
import { isPaymentsPlatformEnabled } from './PaymentFeatureFlags'
import { InvoiceGenerator, type BookingInvoice } from './InvoiceGenerator'
import { PaymentIntentService } from './PaymentIntentService'
import { PaymentMetrics } from './PaymentMetrics'
import { PaymentProviderRegistry } from './PaymentProviderRegistry'
import { generatePaymentReceipt, type PaymentReceipt } from './PaymentReceipt'
import { buildPaymentResult, type PaymentResult } from './PaymentResult'
import { PaymentSessionStore } from './PaymentSession'
import { PaymentValidator } from './PaymentValidator'
import { RefundEngine, type RefundOutcome } from './RefundEngine'
import type {
  PayInput,
  PaymentCheckoutInput,
  PlatformPaymentSession,
  RefundInput,
  SupportedCurrency,
} from './types'

export interface PaymentOrchestratorOptions {
  enabled?: boolean
  sessionStore?: PaymentSessionStore
  registry?: PaymentProviderRegistry
  events?: PaymentEvents
  audit?: PaymentAudit
  metrics?: PaymentMetrics
  onEvent?: (event: PaymentEvent) => void
  /** Optional hook to cancel/release TravelExecutionEngine holds on rollback. */
  releaseExecutionHold?: (executionSessionId: string, reason: string) => Promise<void> | void
}

export class PaymentOrchestrator {
  private readonly sessions: PaymentSessionStore
  private readonly registry: PaymentProviderRegistry
  private readonly events: PaymentEvents
  private readonly audit: PaymentAudit
  private readonly metrics: PaymentMetrics
  private readonly validator: PaymentValidator
  private readonly intents: PaymentIntentService
  private readonly invoices: InvoiceGenerator
  private readonly refunds: RefundEngine
  private readonly forceEnabled: boolean | undefined
  private readonly releaseExecutionHold?: (
    executionSessionId: string,
    reason: string,
  ) => Promise<void> | void
  private readonly receipts = new Map<string, PaymentReceipt>()
  private readonly invoiceBySession = new Map<string, BookingInvoice>()

  constructor(options: PaymentOrchestratorOptions = {}) {
    this.sessions = options.sessionStore ?? new PaymentSessionStore()
    this.registry = options.registry ?? new PaymentProviderRegistry()
    this.events = options.events ?? new PaymentEvents()
    this.audit = options.audit ?? new PaymentAudit()
    this.metrics = options.metrics ?? new PaymentMetrics()
    this.validator = new PaymentValidator()
    this.intents = new PaymentIntentService(this.sessions, this.validator)
    this.invoices = new InvoiceGenerator()
    this.refunds = new RefundEngine(
      this.sessions,
      this.registry,
      this.events,
      this.audit,
      this.metrics,
    )
    this.forceEnabled = options.enabled
    this.releaseExecutionHold = options.releaseExecutionHold

    if (options.onEvent) {
      this.events.on('*', options.onEvent)
    }
  }

  isEnabled(): boolean {
    if (typeof this.forceEnabled === 'boolean') return this.forceEnabled
    return isPaymentsPlatformEnabled()
  }

  /**
   * Bridge from TravelExecutionEngine result → payment checkout session.
   */
  startFromExecution(result: ExecutionResult, extras?: {
    customerEmail?: string | null
    customerName?: string | null
    couponCode?: string | null
    preferredProviderId?: PaymentCheckoutInput['preferredProviderId']
    locale?: 'ar' | 'en'
  }): PlatformPaymentSession {
    this.assertEnabled()
    if (!result.summary.success) {
      throw new PaymentPlatformError(
        'VALIDATION_FAILED',
        'Cannot start payment from failed execution',
      )
    }

    const currency = normalizeCurrency(result.summary.currency)
    return this.createCheckout({
      executionSessionId: result.summary.sessionId,
      conversationId: result.session.context.conversationId,
      tripId: result.session.context.tripId,
      currency,
      subtotal: result.summary.pricing.total,
      flightConfirmation: result.summary.references.flightConfirmation,
      hotelConfirmation: result.summary.references.hotelConfirmation,
      bookingReferenceHint: result.summary.references.bookingReference,
      tripReferenceHint: result.summary.references.tripReference,
      customerEmail: extras?.customerEmail ?? null,
      customerName: extras?.customerName ?? null,
      couponCode: extras?.couponCode ?? null,
      preferredProviderId: extras?.preferredProviderId,
      locale: extras?.locale ?? result.session.context.locale,
      description: `Bilamo booking ${result.summary.references.bookingReference}`,
    })
  }

  createCheckout(input: PaymentCheckoutInput): PlatformPaymentSession {
    this.assertEnabled()
    this.metrics.recordCheckoutStarted()

    let session = this.intents.createIntent(input)
    this.events.emit(createPaymentEvent('PaymentIntentCreated', session.sessionId, {
      intentId: session.intent.intentId,
      amount: session.pricing.total,
      currency: session.pricing.currency,
    }))
    this.audit.record(session.sessionId, 'intent.created', session.state, {
      intentId: session.intent.intentId,
      total: session.pricing.total,
    })

    session = this.reserveInventory(session.sessionId)
    return session
  }

  reserveInventory(sessionId: string): PlatformPaymentSession {
    this.assertEnabled()
    const session = this.sessions.get(sessionId)
    if (!['INTENT_CREATED', 'CREATED'].includes(session.state) && session.inventory) {
      return session
    }

    const holdId = `hold_${Math.random().toString(36).slice(2, 10)}`
    const updated = this.sessions.update(sessionId, {
      state: 'INVENTORY_RESERVED',
      inventory: {
        holdId,
        executionSessionId: session.intent.executionSessionId,
        flightConfirmation: stringOrNull(session.metadata.flightConfirmation),
        hotelConfirmation: stringOrNull(session.metadata.hotelConfirmation),
        reservedAt: new Date().toISOString(),
        releasedAt: null,
        status: 'held',
      },
      intent: {
        ...session.intent,
        status: 'reserved',
        updatedAt: new Date().toISOString(),
      },
    })

    // Move to awaiting payment.
    const awaiting = this.sessions.update(sessionId, { state: 'AWAITING_PAYMENT' })
    this.events.emit(createPaymentEvent('InventoryReserved', sessionId, {
      holdId,
      executionSessionId: updated.intent.executionSessionId,
    }))
    this.audit.record(sessionId, 'inventory.reserved', awaiting.state, { holdId })
    return awaiting
  }

  async pay(sessionId: string, input: PayInput): Promise<PaymentResult> {
    this.assertEnabled()
    this.validator.assertPayInput(input)
    const collected: PaymentEvent[] = []
    const track = (type: Parameters<typeof createPaymentEvent>[0], data?: Record<string, unknown>) => {
      const event = createPaymentEvent(type, sessionId, data)
      collected.push(event)
      this.events.emit(event)
    }

    let session = this.sessions.get(sessionId)
    this.validator.assertNotDuplicatePaid(session)
    this.validator.assertCanPay(session)

    session = this.sessions.update(sessionId, {
      state: 'PROCESSING',
      method: input.method,
      error: null,
    })
    track('PaymentStarted', { method: input.method })
    this.audit.record(sessionId, 'payment.started', 'PROCESSING', { method: input.method })

    try {
      const preferred =
        input.preferredProviderId
        ?? (typeof session.metadata.preferredProviderId === 'string'
          ? (session.metadata.preferredProviderId as PayInput['preferredProviderId'])
          : undefined)

      const { result, provider, failovers } = await this.registry.chargeWithFailover(
        {
          intentId: session.intent.intentId,
          amount: session.pricing.total,
          currency: session.pricing.currency,
          method: input.method,
          customerEmail: session.customerEmail,
          description: session.intent.description,
          idempotencyKey: session.intent.idempotencyKey,
          simulate: input.simulate,
          metadata: { sessionId },
        },
        preferred,
      )

      if (failovers > 0) {
        for (let i = 0; i < failovers; i += 1) this.metrics.recordFailover()
        session = this.sessions.update(sessionId, {
          warnings: [...session.warnings, `Provider failover engaged (${failovers})`],
        })
      }

      if (!result.success) {
        if (result.status === 'declined') this.metrics.recordDeclined()
        if (result.status === 'timeout') this.metrics.recordTimeout()
        this.metrics.recordFailed(result.latencyMs)
        track('PaymentFailed', {
          status: result.status,
          message: result.message,
          providerId: result.providerId,
        })

        session = this.sessions.update(sessionId, {
          state: 'FAILED',
          providerId: result.providerId,
          error: result.message,
        })
        this.audit.record(sessionId, 'payment.failed', 'FAILED', {
          status: result.status,
          message: result.message,
        })

        // Failed payment → release temporary reservations + preserve audit.
        await this.rollbackFailedPayment(sessionId, result.message)
        session = this.sessions.get(sessionId)

        return buildPaymentResult({
          success: false,
          session,
          charge: result,
          events: collected,
          message: result.message,
        })
      }

      // Verify + mark paid
      session = this.sessions.update(sessionId, {
        state: 'PAID',
        providerId: provider.id,
        providerChargeId: result.chargeId,
        paidAt: new Date().toISOString(),
        intent: {
          ...session.intent,
          status: 'charged',
          providerId: provider.id,
          updatedAt: new Date().toISOString(),
        },
      })
      this.metrics.recordSuccess(result.latencyMs)
      track('PaymentSucceeded', {
        providerId: provider.id,
        chargeId: result.chargeId,
      })
      this.audit.record(sessionId, 'payment.succeeded', 'PAID', {
        providerId: provider.id,
        chargeId: result.chargeId,
      })

      // Confirm booking + generate references
      session = this.confirmBooking(sessionId)
      track('BookingConfirmed', { bookingReference: session.bookingRefs?.bookingReference })

      // Receipt + invoice
      const receipt = generatePaymentReceipt(session)
      this.receipts.set(sessionId, receipt)
      session = this.sessions.update(sessionId, { receiptId: receipt.receiptId })

      const invoice = this.invoices.generate(session)
      this.invoiceBySession.set(sessionId, invoice)
      session = this.sessions.update(sessionId, {
        state: 'INVOICED',
        invoiceId: invoice.invoiceId,
      })
      track('InvoiceGenerated', {
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
      })
      this.audit.record(sessionId, 'invoice.generated', 'INVOICED', {
        invoiceId: invoice.invoiceId,
      })

      const invoiced = this.sessions.get(sessionId)
      session = this.sessions.update(sessionId, {
        state: 'COMPLETED',
        completedAt: new Date().toISOString(),
        inventory: invoiced.inventory
          ? { ...invoiced.inventory, status: 'confirmed' }
          : null,
      })
      track('CheckoutCompleted', {
        bookingReference: session.bookingRefs?.bookingReference,
      })
      this.audit.record(sessionId, 'checkout.completed', 'COMPLETED', {})

      return buildPaymentResult({
        success: true,
        session,
        charge: result,
        receipt,
        invoice,
        events: collected,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment failed'
      this.metrics.recordFailed(0)
      track('PaymentFailed', { message })
      session = this.sessions.update(sessionId, {
        state: 'FAILED',
        error: message,
      })
      this.audit.record(sessionId, 'payment.error', 'FAILED', { message })
      await this.rollbackFailedPayment(sessionId, message)
      return buildPaymentResult({
        success: false,
        session: this.sessions.get(sessionId),
        events: collected,
        message,
      })
    }
  }

  confirmBooking(sessionId: string): PlatformPaymentSession {
    const session = this.sessions.get(sessionId)
    if (session.state !== 'PAID' && session.state !== 'BOOKING_CONFIRMED') {
      throw new PaymentPlatformError(
        'INVALID_STATE',
        `Cannot confirm booking in state ${session.state}`,
      )
    }

    const bookingReference =
      stringOrNull(session.metadata.bookingReferenceHint)
      ?? `RHL-BKG-${tail()}`
    const tripReference =
      stringOrNull(session.metadata.tripReferenceHint)
      ?? `RHL-TRP-${tail()}`
    const paymentReference = `RHL-PAY-${tail()}`

    const updated = this.sessions.update(sessionId, {
      state: 'BOOKING_CONFIRMED',
      bookingRefs: {
        bookingReference,
        tripReference,
        paymentReference,
        confirmationNumbers: {
          flight: stringOrNull(session.metadata.flightConfirmation),
          hotel: stringOrNull(session.metadata.hotelConfirmation),
        },
      },
    })
    this.audit.record(sessionId, 'booking.confirmed', 'BOOKING_CONFIRMED', {
      bookingReference,
      paymentReference,
    })
    return updated
  }

  async refund(sessionId: string, input: RefundInput): Promise<RefundOutcome> {
    this.assertEnabled()
    return this.refunds.refund(sessionId, input)
  }

  async rollbackFailedPayment(sessionId: string, reason: string): Promise<PlatformPaymentSession> {
    const session = this.sessions.get(sessionId)
    if (session.state === 'ROLLED_BACK') return session

    const outcome = await this.refunds.refund(sessionId, {
      kind: 'failed_payment_rollback',
      reason,
    })

    if (this.releaseExecutionHold) {
      try {
        await this.releaseExecutionHold(session.intent.executionSessionId, reason)
      } catch (error) {
        this.audit.record(sessionId, 'execution.release_failed', outcome.session.state, {
          message: error instanceof Error ? error.message : 'release_failed',
        })
        // Preserve audit; do not throw — payment rollback already recorded.
        return this.sessions.update(sessionId, {
          warnings: [
            ...outcome.session.warnings,
            'Execution hold release reported an error (see audit)',
          ],
        })
      }
    }

    return outcome.session
  }

  getSession(sessionId: string): PlatformPaymentSession {
    return this.sessions.get(sessionId)
  }

  getReceipt(sessionId: string): PaymentReceipt | null {
    return this.receipts.get(sessionId) ?? null
  }

  getInvoice(sessionId: string): BookingInvoice | null {
    return this.invoiceBySession.get(sessionId) ?? null
  }

  getMetricsSnapshot() {
    return this.metrics.snapshot()
  }

  getAuditLog() {
    return this.audit
  }

  getEventBus() {
    return this.events
  }

  getRegistry() {
    return this.registry
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new PaymentPlatformError(
        'FEATURE_DISABLED',
        'Payments platform is disabled (brain.payments_platform)',
      )
    }
  }
}

export function createPaymentOrchestrator(
  options?: PaymentOrchestratorOptions,
): PaymentOrchestrator {
  return new PaymentOrchestrator(options)
}

function normalizeCurrency(value: string): SupportedCurrency {
  const upper = value.toUpperCase()
  if (upper === 'SAR' || upper === 'USD' || upper === 'EUR' || upper === 'GBP') {
    return upper
  }
  return 'SAR'
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function tail(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}
