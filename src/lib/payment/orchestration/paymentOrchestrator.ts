/**
 * PaymentOrchestrator — Phase S payment orchestration layer.
 *
 * Owns PaymentAdapter selection, PaymentSession state machine transitions,
 * and booking→payment initiation. Delegates order lifecycle to the existing
 * CheckoutOrchestrator (unchanged public API).
 */

import type { BookingSession } from '../../booking/bookingTypes'
import {
  CheckoutOrchestrator,
  type CheckoutInitInput,
  type CheckoutSession,
  type PaymentExecutionResult,
} from '../checkoutOrchestrator'
import type { TravelerInfo } from '../checkoutTypes'
import type { PaymentSession, PaymentSessionStatus } from '../paymentTypes'
import { createPaymentProvider, getDefaultPaymentProviderType } from '../paymentProviderFactory'
import type { PaymentAdapter } from './paymentAdapter'
import { prepareBookingPayment } from './bookingPaymentBridge'
import { createMockPaymentAdapter } from './mockPaymentAdapter'
import { PaymentProviderAdapter } from './paymentProviderAdapter'
import {
  applyPaymentSessionEvent,
  canTransitionPaymentSession,
  isTerminalPaymentStatus,
  transitionPaymentSession,
  type PaymentSessionEvent,
} from './paymentSessionStateMachine'

export interface PaymentOrchestratorOptions {
  adapter?: PaymentAdapter
  checkout?: CheckoutOrchestrator
  /** Soft-persist checkout/orders. Default false in unit tests via callers. */
  persist?: boolean
}

export interface PaymentFlowStartResult {
  success: boolean
  checkoutSession: CheckoutSession | null
  paymentSession: PaymentSession | null
  redirectUrl: string | null
  message: string
  bookingSessionId: string | null
}

export interface PaymentStatusSyncResult {
  success: boolean
  paymentSession: PaymentSession | null
  orderStatus: string | null
  message: string
}

export class PaymentOrchestrator {
  private readonly adapter: PaymentAdapter
  private readonly checkout: CheckoutOrchestrator
  /** Local mirror of sessions for FSM validation / history. */
  private readonly sessions = new Map<string, PaymentSession>()
  private readonly bookingLinks = new Map<string, string>() // orderId → bookingSessionId

  constructor(options: PaymentOrchestratorOptions = {}) {
    this.adapter = options.adapter ?? createDefaultPaymentAdapter()
    const provider = this.adapter instanceof PaymentProviderAdapter
      ? this.adapter.unwrap()
      : createPaymentProvider(this.adapter.providerId === 'moyasar' ? 'moyasar' : 'mock')
    this.checkout = options.checkout ?? new CheckoutOrchestrator(provider, {
      persist: options.persist === true,
    })
  }

  getAdapter(): PaymentAdapter {
    return this.adapter
  }

  getCheckoutOrchestrator(): CheckoutOrchestrator {
    return this.checkout
  }

  getCapabilities() {
    return this.adapter.getCapabilities()
  }

  /**
   * Start checkout + payment session from a BookingSession (library bridge).
   * Does not navigate or alter BookingReview UI.
   */
  async startFromBooking(input: {
    bookingSession: BookingSession
    returnUrl: string
    travelers?: TravelerInfo[]
    customerEmail?: string | null
    customerName?: string | null
    couponCode?: string | null
  }): Promise<PaymentFlowStartResult> {
    try {
      const prepared = prepareBookingPayment({
        bookingSession: input.bookingSession,
        returnUrl: input.returnUrl,
        travelers: input.travelers,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        couponCode: input.couponCode,
      })
      const started = await this.startCheckoutPayment({
        checkoutInit: prepared.checkoutInit,
        customerEmail: prepared.customerEmail,
        customerName: prepared.customerName,
        returnUrl: prepared.returnUrl,
      })
      if (started.checkoutSession?.order) {
        this.bookingLinks.set(started.checkoutSession.order.id, prepared.bookingSessionId)
      }
      return {
        ...started,
        bookingSessionId: prepared.bookingSessionId,
      }
    } catch (error) {
      return {
        success: false,
        checkoutSession: null,
        paymentSession: null,
        redirectUrl: null,
        message: error instanceof Error ? error.message : 'Failed to start booking payment',
        bookingSessionId: input.bookingSession.id,
      }
    }
  }

  /** Start checkout + hosted payment session from cart items. */
  async startCheckoutPayment(input: {
    checkoutInit: CheckoutInitInput
    customerEmail: string | null
    customerName: string | null
    returnUrl: string
  }): Promise<PaymentFlowStartResult> {
    if (!this.adapter.isAvailable()) {
      return {
        success: false,
        checkoutSession: null,
        paymentSession: null,
        redirectUrl: null,
        message: 'Payment adapter is not available',
        bookingSessionId: null,
      }
    }

    const checkoutSession = await this.checkout.initiateCheckout(input.checkoutInit)
    const created = await this.checkout.createPaymentSession(
      checkoutSession.order.id,
      input.customerEmail,
      input.customerName,
      input.returnUrl,
    )

    if (!created.success || !created.paymentSession) {
      return {
        success: false,
        checkoutSession,
        paymentSession: null,
        redirectUrl: null,
        message: created.message || 'Failed to create payment session',
        bookingSessionId: null,
      }
    }

    // Seed FSM from provider status (hosted mock returns pending directly).
    const providerSession = created.paymentSession
    const seeded = transitionPaymentSession({
      session: {
        ...providerSession,
        status: 'created',
        metadata: {
          ...providerSession.metadata,
          adapterId: this.adapter.providerId,
          orchestration: 'payment_orchestrator_v1',
        },
      },
      to: providerSession.status === 'created' ? 'pending' : providerSession.status,
      patch: {
        redirectUrl: providerSession.redirectUrl,
        providerReference: providerSession.providerReference,
      },
    })
    const session = seeded.session
    this.sessions.set(session.id, session)

    return {
      success: true,
      checkoutSession: {
        ...checkoutSession,
        paymentSession: session,
        order: created.order ?? checkoutSession.order,
      },
      paymentSession: session,
      redirectUrl: session.redirectUrl,
      message: 'Payment session created',
      bookingSessionId: this.bookingLinks.get(checkoutSession.order.id) ?? null,
    }
  }

  /** Apply a guarded FSM transition and sync local mirror. */
  transitionSession(
    sessionId: string,
    to: PaymentSessionStatus,
    patch?: Parameters<typeof transitionPaymentSession>[0]['patch'],
  ): PaymentSession {
    const current = this.sessions.get(sessionId)
    if (!current) {
      throw new Error(`Payment session not found: ${sessionId}`)
    }
    const result = transitionPaymentSession({ session: current, to, patch })
    this.sessions.set(sessionId, result.session)
    return result.session
  }

  applySessionEvent(
    sessionId: string,
    event: PaymentSessionEvent,
    patch?: Parameters<typeof applyPaymentSessionEvent>[2],
  ): PaymentSession {
    const current = this.sessions.get(sessionId)
    if (!current) {
      throw new Error(`Payment session not found: ${sessionId}`)
    }
    const result = applyPaymentSessionEvent(current, event, patch)
    this.sessions.set(sessionId, result.session)
    return result.session
  }

  canTransition(sessionId: string, to: PaymentSessionStatus): boolean {
    const current = this.sessions.get(sessionId)
    if (!current) return false
    return canTransitionPaymentSession(current.status, to)
  }

  getSession(sessionId: string): PaymentSession | null {
    return this.sessions.get(sessionId) ?? null
  }

  getBookingSessionIdForOrder(orderId: string): string | null {
    return this.bookingLinks.get(orderId) ?? null
  }

  /**
   * Tokenized authorize+capture via CheckoutOrchestrator, then mirror FSM to paid.
   */
  async captureTokenizedPayment(
    orderId: string,
    lockToken: string,
  ): Promise<PaymentExecutionResult> {
    const result = await this.checkout.executePayment(orderId, lockToken, {
      tokenizedCard: true,
    })
    if (result.success && result.paymentSession) {
      const current = this.sessions.get(result.paymentSession.id) ?? result.paymentSession
      // Mock capture may jump pending → paid; authorize hop first when required.
      let working = current
      if (canTransitionPaymentSession(working.status, 'authorized') && working.status !== 'authorized' && working.status !== 'paid') {
        working = transitionPaymentSession({
          session: working,
          to: 'authorized',
          patch: {
            authorizationCode: result.paymentSession.authorizationCode,
            transactionId: result.paymentSession.transactionId,
          },
        }).session
      }
      const mirrored = transitionPaymentSession({
        session: working,
        to: 'paid',
        force: !canTransitionPaymentSession(working.status, 'paid'),
        patch: {
          paidAt: result.paymentSession.paidAt,
          transactionId: result.paymentSession.transactionId,
          authorizationCode: result.paymentSession.authorizationCode,
        },
      })
      this.sessions.set(mirrored.session.id, mirrored.session)
      return { ...result, paymentSession: mirrored.session }
    }
    if (result.paymentSession && this.sessions.has(result.paymentSession.id)) {
      try {
        const failed = this.transitionSession(result.paymentSession.id, 'failed')
        return { ...result, paymentSession: failed }
      } catch {
        return result
      }
    }
    return result
  }

  /** Reconcile hosted checkout return via existing checkout refresh. */
  async syncHostedPaymentStatus(orderId: string): Promise<PaymentStatusSyncResult> {
    const refreshed = await this.checkout.refreshPaymentStatus(orderId)
    if (!refreshed.success || !refreshed.paymentSession) {
      return {
        success: false,
        paymentSession: refreshed.paymentSession,
        orderStatus: refreshed.order?.status ?? null,
        message: refreshed.message,
      }
    }

    const local = this.sessions.get(refreshed.paymentSession.id)
    const from = local?.status ?? refreshed.paymentSession.status
    const to = refreshed.paymentSession.status
    const mirrored = transitionPaymentSession({
      session: local ?? refreshed.paymentSession,
      to,
      force: !canTransitionPaymentSession(from, to),
      patch: {
        paidAt: refreshed.paymentSession.paidAt,
        transactionId: refreshed.paymentSession.transactionId,
        providerReference: refreshed.paymentSession.providerReference,
        authorizationCode: refreshed.paymentSession.authorizationCode,
        redirectUrl: refreshed.paymentSession.redirectUrl,
      },
    })
    this.sessions.set(mirrored.session.id, mirrored.session)

    return {
      success: true,
      paymentSession: mirrored.session,
      orderStatus: refreshed.order?.status ?? null,
      message: refreshed.message,
    }
  }

  async cancelOrderPayment(
    orderId: string,
    lockToken: string | null = null,
  ): Promise<PaymentExecutionResult> {
    const linkedSessionId = [...this.sessions.values()]
      .find((s) => s.orderId === orderId)?.id
      ?? null
    const result = await this.checkout.cancelCheckout(orderId, lockToken)
    const sessionId = result.paymentSession?.id
      ?? result.order?.paymentSessionId
      ?? linkedSessionId
    if (sessionId && this.sessions.has(sessionId)) {
      const current = this.sessions.get(sessionId)!
      if (!isTerminalPaymentStatus(current.status)) {
        try {
          if (canTransitionPaymentSession(current.status, 'cancelled')) {
            this.transitionSession(sessionId, 'cancelled')
          }
        } catch {
          /* ignore */
        }
      }
    }
    return {
      ...result,
      paymentSession: sessionId ? this.sessions.get(sessionId) ?? result.paymentSession : result.paymentSession,
    }
  }
}

function createDefaultPaymentAdapter(): PaymentAdapter {
  const type = getDefaultPaymentProviderType()
  if (type === 'mock') return createMockPaymentAdapter()
  return new PaymentProviderAdapter(createPaymentProvider(type), {
    mocked: false,
  })
}

let singleton: PaymentOrchestrator | null = null

export function getPaymentOrchestrator(
  options: PaymentOrchestratorOptions = {},
): PaymentOrchestrator {
  if (!singleton || options.adapter || options.checkout) {
    singleton = new PaymentOrchestrator(options)
  }
  return singleton
}

export function resetPaymentOrchestrator(): void {
  singleton = null
}
