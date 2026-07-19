/**
 * Sprint 15 — Payment Session lifecycle over ManagedOrder.
 * Create / resume / expire / retry with duplicate-attempt protection.
 */

import {
  attachPaymentSession,
  getOrder,
  persistPaymentSession,
  syncOrder,
  syncPaymentSession,
  updateOrderStatus,
  type PaymentSession,
  type PaymentSessionStatus,
} from '../payment'
import { getPaymentGateway, type PaymentGatewayId } from './paymentGateways'
import type { ManagedOrder } from './types'
import { getManagedOrder, toManagedOrder } from './orderFromBooking'
import { mapPaymentStatus } from './types'

const ACTIVE_STATUSES: PaymentSessionStatus[] = ['created', 'pending', 'authorized']

/** orderId → active payment session id (duplicate prevention). */
const activeByOrder = new Map<string, string>()
const sessions = new Map<string, PaymentSession>()

function nowIso(): string {
  return new Date().toISOString()
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `ps_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export class DuplicatePaymentAttemptError extends Error {
  readonly orderId: string
  readonly sessionId: string

  constructor(orderId: string, sessionId: string) {
    super(`Active payment session already exists for order ${orderId}`)
    this.name = 'DuplicatePaymentAttemptError'
    this.orderId = orderId
    this.sessionId = sessionId
  }
}

export interface CreatePaymentSessionInput {
  orderId: string
  userId: string
  gatewayId?: PaymentGatewayId
  returnUrl?: string
  customerEmail?: string | null
  /** Allow creating a new session even if one is active (default false). */
  forceNew?: boolean
  /**
   * When true and an active session exists, throw DuplicatePaymentAttemptError
   * instead of resuming (default: resume).
   */
  rejectDuplicate?: boolean
}

export interface PaymentSessionResult {
  ok: boolean
  session: PaymentSession | null
  order: ManagedOrder | null
  error: string | null
  resumed: boolean
}

function cloneSession(session: PaymentSession): PaymentSession {
  return { ...session, metadata: { ...session.metadata } }
}

export function getPaymentSessionById(sessionId: string): PaymentSession | null {
  const s = sessions.get(sessionId)
  return s ? cloneSession(s) : null
}

export function getActivePaymentSessionForOrder(orderId: string): PaymentSession | null {
  const id = activeByOrder.get(orderId)
  if (!id) return null
  const session = sessions.get(id)
  if (!session) return null
  if (!ACTIVE_STATUSES.includes(session.status)) {
    activeByOrder.delete(orderId)
    return null
  }
  if (Date.parse(session.expiresAt) < Date.now()) {
    session.status = 'expired'
    session.updatedAt = nowIso()
    activeByOrder.delete(orderId)
    return cloneSession(session)
  }
  return cloneSession(session)
}

export async function createPaymentSession(
  input: CreatePaymentSessionInput,
): Promise<PaymentSessionResult> {
  const order = getOrder(input.orderId)
  if (!order || order.userId !== input.userId) {
    return { ok: false, session: null, order: null, error: 'Order not found', resumed: false }
  }

  if (!input.forceNew) {
    const existing = getActivePaymentSessionForOrder(order.id)
    if (existing) {
      if (input.rejectDuplicate) {
        throw new DuplicatePaymentAttemptError(order.id, existing.id)
      }
      return {
        ok: true,
        session: existing,
        order: toManagedOrder(order),
        error: null,
        resumed: true,
      }
    }
  }

  const gateway = getPaymentGateway(input.gatewayId ?? 'mock')
  const prepared = await gateway.preparePayment({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: order.cart.total,
    currency: order.cart.currency,
    customerId: order.userId,
    customerEmail: input.customerEmail ?? null,
    returnUrl: input.returnUrl ?? '/checkout/return',
    metadata: { bookingSessionId: order.bookingSessionId ?? null },
  })

  if (!prepared.success) {
    return {
      ok: false,
      session: null,
      order: toManagedOrder(order),
      error: prepared.message,
      resumed: false,
    }
  }

  const now = nowIso()
  const session: PaymentSession = {
    id: generateSessionId(),
    orderId: order.id,
    orderNumber: order.orderNumber,
    providerId: gateway.gatewayId === 'mock' ? 'mock' : 'mock',
    status: 'pending',
    amount: order.cart.total,
    currency: order.cart.currency,
    paymentMethod: null,
    providerReference: prepared.providerSessionId,
    authorizationCode: null,
    transactionId: null,
    redirectUrl: prepared.redirectUrl,
    description: `Payment for ${order.orderNumber}`,
    customerEmail: input.customerEmail ?? null,
    customerName: null,
    metadata: {
      gatewayId: gateway.gatewayId,
      bookingSessionId: order.bookingSessionId ?? null,
      sprint: 15,
    },
    createdAt: now,
    updatedAt: now,
    paidAt: null,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  }

  sessions.set(session.id, session)
  activeByOrder.set(order.id, session.id)
  attachPaymentSession(order.id, session)
  updateOrderStatus(order.id, 'pending_payment')
  const updatedOrder = getOrder(order.id)!

  await persistPaymentSession(session).catch((err) => {
    console.warn('[payment] persistPaymentSession failed (in-memory session retained)', err)
  })
  await syncOrder(updatedOrder).catch((err) => {
    console.warn('[payment] syncOrder failed (in-memory order retained)', err)
  })

  return {
    ok: true,
    session: cloneSession(session),
    order: toManagedOrder(updatedOrder),
    error: null,
    resumed: false,
  }
}

export async function resumePaymentSession(
  orderId: string,
  userId: string,
): Promise<PaymentSessionResult> {
  const order = getOrder(orderId)
  if (!order || order.userId !== userId) {
    return { ok: false, session: null, order: null, error: 'Order not found', resumed: false }
  }
  const existing = getActivePaymentSessionForOrder(orderId)
  if (existing) {
    return {
      ok: true,
      session: existing,
      order: toManagedOrder(order),
      error: null,
      resumed: true,
    }
  }
  return createPaymentSession({ orderId, userId })
}

export function expirePaymentSession(sessionId: string): PaymentSession | null {
  const session = sessions.get(sessionId)
  if (!session) return null
  if (session.status === 'paid' || session.status === 'refunded') return cloneSession(session)
  session.status = 'expired'
  session.updatedAt = nowIso()
  if (activeByOrder.get(session.orderId) === sessionId) {
    activeByOrder.delete(session.orderId)
  }
  void syncPaymentSession(session, 'pending').catch(() => undefined)
  return cloneSession(session)
}

export async function retryPaymentSession(
  orderId: string,
  userId: string,
): Promise<PaymentSessionResult> {
  const active = getActivePaymentSessionForOrder(orderId)
  if (active) {
    expirePaymentSession(active.id)
  }
  // Also expire any failed session pointer
  activeByOrder.delete(orderId)
  return createPaymentSession({ orderId, userId, forceNew: true })
}

export function paymentStatusForOrder(orderId: string): ReturnType<typeof mapPaymentStatus> {
  const order = getOrder(orderId)
  if (!order) return 'not_started'
  const session = getActivePaymentSessionForOrder(orderId)
    ?? (order.paymentSessionId ? sessions.get(order.paymentSessionId) : null)
  return mapPaymentStatus(order.status, session?.status ?? null)
}

/** Mark mock payment as paid (prep layer only — no live gateway). */
export async function markMockPaymentPaid(sessionId: string): Promise<PaymentSessionResult> {
  const session = sessions.get(sessionId)
  if (!session) {
    return { ok: false, session: null, order: null, error: 'Payment session not found', resumed: false }
  }
  session.status = 'paid'
  session.paidAt = nowIso()
  session.updatedAt = nowIso()
  activeByOrder.delete(session.orderId)
  const { markOrderPaid, generateInvoiceNumber } = await import('../payment/orderManager')
  const existingOrder = getOrder(session.orderId)
  const invoice = existingOrder
    ? generateInvoiceNumber(existingOrder)
    : `INV-${new Date().getFullYear()}-MOCK`
  markOrderPaid(session.orderId, invoice)
  const order = getOrder(session.orderId)
  await syncPaymentSession(session, 'pending').catch(() => undefined)
  if (order) await syncOrder(order).catch(() => undefined)
  return {
    ok: true,
    session: cloneSession(session),
    order: order ? toManagedOrder(order) : getManagedOrder(session.orderId),
    error: null,
    resumed: false,
  }
}

export function clearPaymentSessionStore(): void {
  sessions.clear()
  activeByOrder.clear()
}

/** Alias — Sprint 15 product wording. */
export const createPaymentSessionForOrder = createPaymentSession

/** Alias for CreatePaymentSessionResult naming in docs. */
export type CreatePaymentSessionResult = PaymentSessionResult
