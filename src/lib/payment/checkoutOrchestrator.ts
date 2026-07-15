import type {
  RahhalOrder,
  CheckoutCart,
  CheckoutItem,
  TravelerInfo,
} from './checkoutTypes'
import type {
  PaymentSession,
} from './paymentTypes'
import type { PaymentProvider } from './paymentProvider'
import {
  createOrder,
  getOrder,
  updateOrderStatus,
  attachPaymentSession,
  markOrderPaid,
  markOrderConfirmed,
  buildCart,
  generateInvoiceNumber,
  generateItineraryId,
} from './orderManager'
import { validateCoupon } from './couponValidator'
import {
  acquireLock,
  releaseLock,
  verifyLock,
  getLock,
} from './bookingLock'
import { generateInvoice } from './invoiceGenerator'
import { generateItinerary } from './itineraryGenerator'
import type { Invoice } from './invoiceGenerator'
import type { Itinerary } from './itineraryGenerator'
import {
  persistOrder,
  syncOrder,
  persistPaymentSession,
  syncPaymentSession,
  persistLock,
  releaseLockInDb,
  loadOrder,
  loadPaymentSession,
  softPersist,
} from './checkoutPersistence'

export interface CheckoutInitInput {
  userId: string
  travelSessionId: string | null
  items: CheckoutItem[]
  currency: string
  travelers: TravelerInfo[]
  couponCode: string | null
}

export interface CheckoutSession {
  order: RahhalOrder
  cart: CheckoutCart
  lockToken: string | null
  paymentSession: PaymentSession | null
}

export interface PaymentExecutionResult {
  success: boolean
  order: RahhalOrder | null
  paymentSession: PaymentSession | null
  invoice: Invoice | null
  itinerary: Itinerary | null
  message: string
}

export interface CheckoutOrchestratorOptions {
  /** When true, write-through to Supabase (soft-fail). Default true. */
  persist?: boolean
}

export class CheckoutOrchestrator {
  private provider: PaymentProvider
  private paymentSessions: Map<string, PaymentSession> = new Map()
  private persistEnabled: boolean

  constructor(provider: PaymentProvider, options: CheckoutOrchestratorOptions = {}) {
    this.provider = provider
    this.persistEnabled = options.persist !== false
  }

  async initiateCheckout(input: CheckoutInitInput): Promise<CheckoutSession> {
    let discountAmount = 0
    if (input.couponCode) {
      const tempCart = buildCart(input.items, input.currency, null, 0)
      const couponResult = validateCoupon(input.couponCode, tempCart)
      if (couponResult.valid) {
        discountAmount = couponResult.discountAmount
      }
    }

    const cart = buildCart(input.items, input.currency, input.couponCode, discountAmount)
    const order = createOrder({
      userId: input.userId,
      travelSessionId: input.travelSessionId,
      cart,
      travelers: input.travelers,
      couponCode: input.couponCode,
      discountAmount,
    })

    const lock = acquireLock(order.id, input.userId)

    if (this.persistEnabled) {
      await softPersist(async () => {
        await persistOrder(order)
        if (lock) await persistLock(lock)
      })
    }

    return {
      order,
      cart,
      lockToken: lock?.lockToken ?? null,
      paymentSession: null,
    }
  }

  async createPaymentSession(
    orderId: string,
    customerEmail: string | null,
    customerName: string | null,
    returnUrl: string,
  ): Promise<PaymentExecutionResult> {
    const order = await this.resolveOrder(orderId)
    if (!order) {
      return this.failure('Order not found', null)
    }

    const result = await this.provider.createPaymentSession({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.cart.total,
      currency: order.cart.currency,
      description: `Rahhal Order ${order.orderNumber}`,
      customerEmail,
      customerName,
      returnUrl,
      metadata: { orderNumber: order.orderNumber, bookingNumber: order.bookingNumber },
    })

    if (!result.success) {
      updateOrderStatus(orderId, 'failed')
      if (this.persistEnabled) {
        const failed = getOrder(orderId)
        if (failed) await softPersist(() => syncOrder(failed))
      }
      return this.failure(result.message, null)
    }

    const paymentSession: PaymentSession = {
      id: result.paymentSessionId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      providerId: result.providerId,
      status: result.status,
      amount: order.cart.total,
      currency: order.cart.currency,
      paymentMethod: null,
      providerReference: result.providerReference,
      authorizationCode: result.authorizationCode,
      transactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      description: `Rahhal Order ${order.orderNumber}`,
      customerEmail,
      customerName,
      metadata: result.metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paidAt: null,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }

    this.paymentSessions.set(paymentSession.id, paymentSession)
    attachPaymentSession(orderId, paymentSession)
    updateOrderStatus(orderId, 'pending_payment')

    if (this.persistEnabled) {
      await softPersist(async () => {
        await persistPaymentSession(paymentSession)
        const updated = getOrder(orderId)
        if (updated) await syncOrder(updated)
      })
    }

    return {
      success: true,
      order: getOrder(orderId),
      paymentSession,
      invoice: null,
      itinerary: null,
      message: 'Payment session created',
    }
  }

  async executePayment(orderId: string, lockToken: string): Promise<PaymentExecutionResult> {
    const order = await this.resolveOrder(orderId)
    if (!order) {
      return this.failure('Order not found', null)
    }

    if (!verifyLock(orderId, lockToken)) {
      return this.failure('Booking lock is invalid or expired. Preventing duplicate payment.', order)
    }

    if (!order.paymentSessionId) {
      return this.failure('No payment session attached to order', order)
    }

    let paymentSession = this.paymentSessions.get(order.paymentSessionId) ?? null
    if (!paymentSession && this.persistEnabled) {
      paymentSession = await loadPaymentSession(order.paymentSessionId)
      if (paymentSession) this.paymentSessions.set(paymentSession.id, paymentSession)
    }
    if (!paymentSession) {
      return this.failure('Payment session not found', order)
    }

    if (paymentSession.status === 'paid') {
      return this.failure('Payment already completed', order)
    }

    const fromStatus = paymentSession.status
    const authResult = await this.provider.authorizePayment(paymentSession.id)
    if (!authResult.success) {
      paymentSession.status = 'failed'
      paymentSession.updatedAt = new Date().toISOString()
      updateOrderStatus(orderId, 'failed')
      if (this.persistEnabled) {
        await softPersist(async () => {
          await syncPaymentSession(paymentSession!, fromStatus)
          const failed = getOrder(orderId)
          if (failed) await syncOrder(failed)
        })
      }
      return this.failure(authResult.message, order)
    }

    paymentSession.status = authResult.status
    paymentSession.authorizationCode = authResult.authorizationCode
    paymentSession.transactionId = authResult.transactionId
    paymentSession.updatedAt = new Date().toISOString()

    const captureResult = await this.provider.capturePayment(paymentSession.id)
    if (!captureResult.success) {
      const preCapture = paymentSession.status
      paymentSession.status = 'failed'
      paymentSession.updatedAt = new Date().toISOString()
      updateOrderStatus(orderId, 'failed')
      if (this.persistEnabled) {
        await softPersist(async () => {
          await syncPaymentSession(paymentSession!, preCapture)
          const failed = getOrder(orderId)
          if (failed) await syncOrder(failed)
        })
      }
      return this.failure(captureResult.message, order)
    }

    paymentSession.status = 'paid'
    paymentSession.paidAt = captureResult.paidAt ?? new Date().toISOString()
    paymentSession.updatedAt = new Date().toISOString()

    const invoiceNumber = generateInvoiceNumber(order)
    markOrderPaid(orderId, invoiceNumber)

    const itineraryId = generateItineraryId(order)
    markOrderConfirmed(orderId, itineraryId)

    const lock = getLock(orderId)
    releaseLock(orderId, lockToken)

    const updatedOrder = getOrder(orderId)!
    const invoice = generateInvoice(updatedOrder)
    const itinerary = generateItinerary(updatedOrder)

    if (this.persistEnabled) {
      await softPersist(async () => {
        await syncPaymentSession(paymentSession!, fromStatus)
        await syncOrder(updatedOrder)
        if (lock) await releaseLockInDb(lock.id)
      })
    }

    return {
      success: true,
      order: updatedOrder,
      paymentSession,
      invoice,
      itinerary,
      message: 'Payment successful, order confirmed, invoice and itinerary generated',
    }
  }

  async retryPayment(orderId: string): Promise<PaymentExecutionResult> {
    const order = await this.resolveOrder(orderId)
    if (!order) {
      return this.failure('Order not found', null)
    }
    if (order.status === 'paid' || order.status === 'confirmed') {
      return this.failure('Order is already paid', order)
    }

    const lock = acquireLock(order.id, order.userId)
    if (!lock) {
      return this.failure('Cannot acquire lock for retry. Another payment in progress.', order)
    }

    if (this.persistEnabled) {
      await softPersist(() => persistLock(lock))
    }

    return this.createPaymentSession(orderId, null, null, '')
  }

  async cancelCheckout(orderId: string, lockToken: string | null): Promise<PaymentExecutionResult> {
    const order = await this.resolveOrder(orderId)
    if (!order) {
      return this.failure('Order not found', null)
    }

    const lock = getLock(orderId)
    if (lockToken) {
      releaseLock(orderId, lockToken)
    }

    updateOrderStatus(orderId, 'cancelled')
    if (this.persistEnabled) {
      await softPersist(async () => {
        const updated = getOrder(orderId)
        if (updated) await syncOrder(updated)
        if (lock) await releaseLockInDb(lock.id)
      })
    }

    return {
      success: true,
      order: getOrder(orderId),
      paymentSession: null,
      invoice: null,
      itinerary: null,
      message: 'Checkout cancelled',
    }
  }

  async recoverAbandonedCheckout(orderId: string): Promise<PaymentExecutionResult> {
    const order = await this.resolveOrder(orderId)
    if (!order) {
      return this.failure('Order not found', null)
    }

    if (order.status === 'paid' || order.status === 'confirmed') {
      return this.failure('Order is already completed', order)
    }

    if (order.status === 'cancelled' || order.status === 'refunded') {
      return this.failure('Cannot recover a cancelled or refunded order', order)
    }

    const existingLock = getLock(orderId)
    if (existingLock && existingLock.status === 'active') {
      return {
        success: true,
        order,
        paymentSession: order.paymentSessionId
          ? this.paymentSessions.get(order.paymentSessionId)
            ?? (this.persistEnabled ? await loadPaymentSession(order.paymentSessionId) : null)
          : null,
        invoice: null,
        itinerary: null,
        message: 'Checkout resumed — payment in progress',
      }
    }

    const newLock = acquireLock(order.id, order.userId)
    if (newLock && this.persistEnabled) {
      await softPersist(() => persistLock(newLock))
    }
    return {
      success: true,
      order,
      paymentSession: order.paymentSessionId
        ? this.paymentSessions.get(order.paymentSessionId)
          ?? (this.persistEnabled ? await loadPaymentSession(order.paymentSessionId) : null)
        : null,
      invoice: null,
      itinerary: null,
      message: 'Abandoned checkout recovered. New lock acquired.',
    }
  }

  getPaymentSession(paymentSessionId: string): PaymentSession | null {
    return this.paymentSessions.get(paymentSessionId) ?? null
  }

  getOrder(orderId: string): RahhalOrder | null {
    return getOrder(orderId)
  }

  /**
   * Fetch live Moyasar/provider status and sync the checkout persistence session.
   * Maps paid / pending / failed / cancelled back onto the order + payment session.
   */
  async refreshPaymentStatus(orderId: string): Promise<PaymentExecutionResult> {
    const order = await this.resolveOrder(orderId)
    if (!order) {
      return this.failure('Order not found', null)
    }
    if (!order.paymentSessionId) {
      return this.failure('No payment session attached to order', order)
    }

    let paymentSession = this.paymentSessions.get(order.paymentSessionId) ?? null
    if (!paymentSession && this.persistEnabled) {
      paymentSession = await loadPaymentSession(order.paymentSessionId)
      if (paymentSession) this.paymentSessions.set(paymentSession.id, paymentSession)
    }
    if (!paymentSession) {
      return this.failure('Payment session not found', order)
    }

    const fromStatus = paymentSession.status
    let status = await this.provider.getPaymentStatus(paymentSession.id)
    if (!status) {
      return this.failure('Could not retrieve payment status from provider', order)
    }

    paymentSession.status = status
    paymentSession.updatedAt = new Date().toISOString()

    if (status === 'paid') {
      paymentSession.paidAt = paymentSession.paidAt ?? new Date().toISOString()
      const invoiceNumber = generateInvoiceNumber(order)
      markOrderPaid(orderId, invoiceNumber)
      const itineraryId = generateItineraryId(order)
      markOrderConfirmed(orderId, itineraryId)
    } else if (status === 'failed' || status === 'cancelled' || status === 'expired') {
      updateOrderStatus(orderId, status === 'cancelled' ? 'cancelled' : 'failed')
    } else if (status === 'pending' || status === 'authorized' || status === 'created') {
      updateOrderStatus(orderId, 'pending_payment')
    }

    const updatedOrder = getOrder(orderId)
    if (this.persistEnabled && updatedOrder) {
      await softPersist(async () => {
        await syncPaymentSession(paymentSession!, fromStatus)
        await syncOrder(updatedOrder)
      })
    }

    return {
      success: status === 'paid' || status === 'pending' || status === 'authorized' || status === 'created',
      order: updatedOrder,
      paymentSession,
      invoice: null,
      itinerary: null,
      message: `Payment status: ${status}`,
    }
  }

  private async resolveOrder(orderId: string): Promise<RahhalOrder | null> {
    const cached = getOrder(orderId)
    if (cached) return cached
    if (!this.persistEnabled) return null
    return loadOrder(orderId)
  }

  private failure(message: string, order: RahhalOrder | null): PaymentExecutionResult {
    return {
      success: false,
      order,
      paymentSession: null,
      invoice: null,
      itinerary: null,
      message,
    }
  }
}

let cachedOrchestrator: CheckoutOrchestrator | null = null

export function getCheckoutOrchestrator(provider: PaymentProvider): CheckoutOrchestrator {
  if (cachedOrchestrator) return cachedOrchestrator
  cachedOrchestrator = new CheckoutOrchestrator(provider)
  return cachedOrchestrator
}

export function resetCheckoutOrchestrator(): void {
  cachedOrchestrator = null
}
