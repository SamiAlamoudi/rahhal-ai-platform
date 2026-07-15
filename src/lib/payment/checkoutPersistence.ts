/**
 * Maps checkout domain objects ↔ Supabase rows and write-through helpers.
 * In-memory Maps remain the hot path for unit tests; UI flows call persist*.
 */

import type { RahhalOrder, CheckoutCart, TravelerInfo, Coupon } from './checkoutTypes'
import type { PaymentSession } from './paymentTypes'
import type { BookingLock } from './bookingLock'
import type {
  OrderRow,
  PaymentSessionRow,
  BookingLockRow,
  CouponRow,
} from './paymentRowTypes'
import { orderRepository } from '../repositories/orderRepository'
import {
  paymentSessionRepository,
  paymentEventRepository,
} from '../repositories/paymentSessionRepository'
import {
  bookingLockRepository,
  couponRepository,
} from '../repositories/bookingLockRepository'
import { hydrateOrder } from './orderManager'

export function orderToCreateInput(order: RahhalOrder) {
  return {
    id: order.id,
    travel_session_id: order.travelSessionId,
    order_number: order.orderNumber,
    booking_number: order.bookingNumber,
    customer_reference: order.customerReference,
    status: order.status,
    cart: order.cart as unknown as Record<string, unknown>,
    travelers: { list: order.travelers } as unknown as Record<string, unknown>,
    coupon_code: order.couponCode,
    discount_amount: order.discountAmount,
  }
}

export function orderFromRow(row: OrderRow): RahhalOrder {
  const cart = (row.cart ?? {}) as unknown as CheckoutCart
  const travelersRaw = row.travelers as { list?: TravelerInfo[] } | TravelerInfo[] | null
  const travelers = Array.isArray(travelersRaw)
    ? travelersRaw
    : Array.isArray(travelersRaw?.list)
      ? travelersRaw.list
      : []

  return {
    id: row.id,
    orderNumber: row.order_number,
    bookingNumber: row.booking_number,
    customerReference: row.customer_reference,
    userId: row.user_id,
    travelSessionId: row.travel_session_id,
    status: row.status as RahhalOrder['status'],
    cart: {
      items: Array.isArray(cart.items) ? cart.items : [],
      subtotal: Number(cart.subtotal ?? 0),
      taxes: Number(cart.taxes ?? 0),
      fees: Number(cart.fees ?? 0),
      discount: Number(cart.discount ?? row.discount_amount ?? 0),
      total: Number(cart.total ?? 0),
      currency: cart.currency || 'SAR',
    },
    travelers,
    couponCode: row.coupon_code,
    discountAmount: Number(row.discount_amount ?? 0),
    paymentSessionId: row.payment_session_id,
    paymentProvider: row.payment_provider,
    paidAt: row.paid_at,
    confirmedAt: row.confirmed_at,
    invoiceNumber: row.invoice_number,
    itineraryId: row.itinerary_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function paymentSessionToCreateInput(session: PaymentSession) {
  return {
    id: session.id,
    order_id: session.orderId,
    order_number: session.orderNumber,
    provider_id: session.providerId,
    status: session.status,
    amount: session.amount,
    currency: session.currency,
    description: session.description,
    customer_email: session.customerEmail,
    customer_name: session.customerName,
    metadata: {
      ...session.metadata,
      redirectUrl: session.redirectUrl,
      providerReference: session.providerReference,
      authorizationCode: session.authorizationCode,
      transactionId: session.transactionId,
      paymentMethod: session.paymentMethod,
    },
    expires_at: session.expiresAt,
  }
}

export function paymentSessionFromRow(row: PaymentSessionRow): PaymentSession {
  const meta = (row.metadata ?? {}) as Record<string, unknown>
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number,
    providerId: row.provider_id as PaymentSession['providerId'],
    status: row.status as PaymentSession['status'],
    amount: Number(row.amount),
    currency: row.currency,
    paymentMethod: (row.payment_method ?? (meta.paymentMethod as string | null) ?? null) as PaymentSession['paymentMethod'],
    providerReference: row.provider_reference ?? (meta.providerReference as string | null) ?? null,
    authorizationCode: row.authorization_code ?? (meta.authorizationCode as string | null) ?? null,
    transactionId: row.transaction_id ?? (meta.transactionId as string | null) ?? null,
    redirectUrl: (meta.redirectUrl as string | null) ?? null,
    description: row.description,
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    metadata: meta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
    expiresAt: row.expires_at,
  }
}

export function lockToCreateInput(lock: BookingLock) {
  return {
    id: lock.id,
    order_id: lock.orderId,
    lock_token: lock.lockToken,
    status: lock.status,
    expires_at: lock.expiresAt,
  }
}

export function lockFromRow(row: BookingLockRow): BookingLock {
  return {
    id: row.id,
    orderId: row.order_id,
    userId: row.user_id,
    status: row.status as BookingLock['status'],
    lockToken: row.lock_token,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    releasedAt: row.released_at,
  }
}

export function couponFromRow(row: CouponRow): Coupon {
  return {
    code: row.code,
    type: row.type as Coupon['type'],
    value: Number(row.value),
    currency: row.currency,
    minOrderAmount: row.min_order_amount,
    maxDiscount: row.max_discount,
    expiresAt: row.expires_at,
    active: row.active,
    description: row.description,
  }
}

export async function persistOrder(order: RahhalOrder): Promise<void> {
  await orderRepository.create(orderToCreateInput(order))
}

export async function syncOrder(order: RahhalOrder): Promise<void> {
  await orderRepository.update(order.id, {
    status: order.status,
    cart: order.cart as unknown as Record<string, unknown>,
    travelers: { list: order.travelers } as unknown as Record<string, unknown>,
    coupon_code: order.couponCode,
    discount_amount: order.discountAmount,
    payment_session_id: order.paymentSessionId,
    payment_provider: order.paymentProvider,
    paid_at: order.paidAt,
    confirmed_at: order.confirmedAt,
    invoice_number: order.invoiceNumber,
    itinerary_id: order.itineraryId,
  })
}

export async function persistPaymentSession(session: PaymentSession): Promise<void> {
  await paymentSessionRepository.create(paymentSessionToCreateInput(session))
  await paymentEventRepository.create({
    payment_session_id: session.id,
    event_type: 'session_created',
    from_status: null,
    to_status: session.status,
    details: { orderId: session.orderId, providerId: session.providerId },
  })
}

export async function syncPaymentSession(
  session: PaymentSession,
  fromStatus: string | null,
): Promise<void> {
  await paymentSessionRepository.update(session.id, {
    status: session.status,
    payment_method: session.paymentMethod,
    provider_reference: session.providerReference,
    authorization_code: session.authorizationCode,
    transaction_id: session.transactionId,
    paid_at: session.paidAt,
    metadata: {
      ...(session.metadata || {}),
      redirectUrl: session.redirectUrl,
    },
  })
  await paymentEventRepository.create({
    payment_session_id: session.id,
    event_type: 'status_changed',
    from_status: fromStatus,
    to_status: session.status,
    details: {},
  })
}

export async function persistLock(lock: BookingLock): Promise<void> {
  await bookingLockRepository.create(lockToCreateInput(lock))
}

export async function releaseLockInDb(lockId: string): Promise<void> {
  await bookingLockRepository.update(lockId, {
    status: 'released',
    released_at: new Date().toISOString(),
  })
}

export async function loadOrder(orderId: string): Promise<RahhalOrder | null> {
  const row = await orderRepository.getById(orderId)
  if (!row) return null
  const order = orderFromRow(row)
  hydrateOrder(order)
  return order
}

export async function loadOrdersForUser(limit = 50): Promise<RahhalOrder[]> {
  const rows = await orderRepository.listByUser(limit)
  return rows.map((row) => {
    const order = orderFromRow(row)
    hydrateOrder(order)
    return order
  })
}

export async function loadPaymentSession(id: string): Promise<PaymentSession | null> {
  const row = await paymentSessionRepository.getById(id)
  return row ? paymentSessionFromRow(row) : null
}

export async function loadCouponFromDb(code: string): Promise<Coupon | null> {
  const row = await couponRepository.getByCode(code.toUpperCase())
  return row ? couponFromRow(row) : null
}

export async function softPersist(fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[checkoutPersistence]', err instanceof Error ? err.message : err)
    }
  }
}

/** Persisted checkout session snapshot (order + optional payment + lock). */
export interface PersistedCheckoutSession {
  order: RahhalOrder
  paymentSession: PaymentSession | null
  lock: BookingLock | null
  cart: CheckoutCart
  lockToken: string | null
}

/**
 * Create (persist) a checkout session: stores the selected itinerary/cart
 * on the orders table and an optional booking lock.
 */
export async function createCheckoutSession(
  order: RahhalOrder,
  lock: BookingLock | null = null,
): Promise<PersistedCheckoutSession> {
  await persistOrder(order)
  if (lock) await persistLock(lock)
  return {
    order,
    paymentSession: null,
    lock,
    cart: order.cart,
    lockToken: lock?.lockToken ?? null,
  }
}

/** Retrieve a checkout session (order + payment session + active lock). */
export async function getCheckoutSession(orderId: string): Promise<PersistedCheckoutSession | null> {
  const order = await loadOrder(orderId)
  if (!order) return null

  const paymentSession = order.paymentSessionId
    ? await loadPaymentSession(order.paymentSessionId)
    : null

  const lockRow = await bookingLockRepository.getActiveByOrderId(orderId)
  const lock = lockRow ? lockFromRow(lockRow) : null

  return {
    order,
    paymentSession,
    lock,
    cart: order.cart,
    lockToken: lock?.lockToken ?? null,
  }
}

/**
 * Update a checkout session — syncs order (and optional payment session)
 * so itinerary/status/payment fields stay durable.
 */
export async function updateCheckoutSession(
  order: RahhalOrder,
  paymentSession: PaymentSession | null = null,
  paymentFromStatus: string | null = null,
): Promise<PersistedCheckoutSession> {
  await syncOrder(order)
  if (paymentSession) {
    await syncPaymentSession(paymentSession, paymentFromStatus)
  }

  const lockRow = await bookingLockRepository.getActiveByOrderId(order.id)
  const lock = lockRow ? lockFromRow(lockRow) : null

  return {
    order,
    paymentSession,
    lock,
    cart: order.cart,
    lockToken: lock?.lockToken ?? null,
  }
}
