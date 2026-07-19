/**
 * Create / load ManagedOrder from a confirmed BookingSession.
 */

import {
  buildCart,
  createOrder,
  getOrder,
  listAllOrders,
  listOrdersByUser,
  persistOrder,
  updateOrderStatus,
  type RahhalOrder,
  type TravelerInfo,
} from '../payment'
import { TAX_RATE } from '../payment/checkoutTypes'
import { prepareBookingPayment } from '../payment/orchestration/bookingPaymentBridge'
import {
  getBookingOrchestrator,
  resolveBookingReference,
  type BookingSession,
} from '../booking'
import { readPassengersFromSession } from '../passengers/persistPassengers'
import type {
  CreateOrderFromBookingInput,
  CreateOrderFromBookingResult,
  ManagedOrder,
  OrderItinerarySummary,
} from './types'
import { mapOrderStatus, mapPaymentStatus, orderCheckoutPath } from './types'

/** In-memory bookingSessionId → orderId index (also mirrored on order.bookingSessionId). */
const bookingOrderIndex = new Map<string, string>()

function passengersFromSession(session: BookingSession): TravelerInfo[] {
  const passengers = readPassengersFromSession(session) ?? []
  return passengers.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    dateOfBirth: p.dateOfBirth || null,
    passportNumber: p.passportNumber || null,
    passportExpiry: p.passportExpiry || null,
    nationality: p.nationality || null,
    type: p.type,
  }))
}

function itineraryFromSession(session: BookingSession): OrderItinerarySummary | null {
  const item = session.items.find((i) => i.type === 'flight') ?? session.items[0]
  if (!item) return null
  const itinerary = (item.metadata.selectedItinerary ?? {}) as Record<string, unknown>
  const origin = String(itinerary.origin ?? '')
  const destination = String(itinerary.destination ?? '')
  return {
    title: item.title,
    origin,
    destination,
    departureTime: String(itinerary.departureTime ?? ''),
    arrivalTime: String(itinerary.arrivalTime ?? ''),
    airline: String(itinerary.airline ?? item.providerName ?? ''),
    cabin: String(itinerary.cabin ?? ''),
    summary: origin && destination ? `${origin} → ${destination}` : item.title,
  }
}

export function toManagedOrder(order: RahhalOrder): ManagedOrder {
  const flightItem = order.cart.items.find((i) => i.type === 'flight') ?? order.cart.items[0]
  const itineraryMeta = (flightItem?.metadata?.selectedItinerary ?? {}) as Record<string, unknown>
  const origin = String(itineraryMeta.origin ?? '')
  const destination = String(itineraryMeta.destination ?? '')
  const itinerary: OrderItinerarySummary | null = flightItem
    ? {
        title: flightItem.title,
        origin,
        destination,
        departureTime: String(itineraryMeta.departureTime ?? ''),
        arrivalTime: String(itineraryMeta.arrivalTime ?? ''),
        airline: String(itineraryMeta.airline ?? flightItem.providerName ?? ''),
        cabin: String(itineraryMeta.cabin ?? ''),
        summary: origin && destination ? `${origin} → ${destination}` : flightItem.title,
      }
    : null

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    bookingReference: order.bookingNumber,
    bookingSessionId: order.bookingSessionId ?? null,
    customerId: order.userId,
    passengers: order.travelers,
    itinerary,
    fareBreakdown: {
      baseFare: order.cart.subtotal,
      taxes: order.cart.taxes,
      fees: order.cart.fees,
      discount: order.cart.discount,
      total: order.cart.total,
    },
    totalAmount: order.cart.total,
    currency: order.cart.currency,
    orderStatus: mapOrderStatus(order.status),
    paymentStatus: mapPaymentStatus(order.status),
    rawOrderStatus: order.status,
    paymentSessionId: order.paymentSessionId,
    cart: order.cart,
    checkoutPath: orderCheckoutPath(order.id),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt,
    confirmedAt: order.confirmedAt,
  }
}

export function findOrderByBookingSessionId(bookingSessionId: string): ManagedOrder | null {
  const indexed = bookingOrderIndex.get(bookingSessionId)
  if (indexed) {
    const order = getOrder(indexed)
    if (order) return toManagedOrder(order)
  }
  for (const order of listAllOrders()) {
    if (order.bookingSessionId === bookingSessionId) {
      bookingOrderIndex.set(bookingSessionId, order.id)
      return toManagedOrder(order)
    }
  }
  return null
}

/** Alias — Concierge / docs prefer this name. */
export const findManagedOrderBySessionId = findOrderByBookingSessionId

/** Mirror orderId pointer onto BookingSession item metadata (not a second SoT). */
export function persistManagedOrderLink(
  bookingSessionId: string,
  order: ManagedOrder,
): void {
  const orch = getBookingOrchestrator()
  const session = orch.getBookingSession(bookingSessionId)
  if (!session) return
  const item = session.items[0]
  if (!item) return
  orch.updateBookingItem(bookingSessionId, item.id, {
    metadata: {
      ...item.metadata,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      sprint: Math.max(Number(item.metadata.sprint ?? 0), 15),
    },
  })
  bookingOrderIndex.set(bookingSessionId, order.orderId)
}

export async function createOrderFromBooking(
  input: CreateOrderFromBookingInput,
): Promise<CreateOrderFromBookingResult> {
  const orch = getBookingOrchestrator()
  const session = orch.getBookingSession(input.bookingSessionId)
  if (!session || session.userId !== input.userId) {
    throw new Error('Booking session not found')
  }
  if (!session.items.length) {
    throw new Error('Booking session has no items')
  }

  if (!input.forceNew) {
    const existing = findOrderByBookingSessionId(session.id)
    if (existing && existing.customerId === input.userId) {
      return { order: existing, created: false }
    }
    // Also check user orders for bookingSessionId
    for (const order of listOrdersByUser(input.userId)) {
      if (order.bookingSessionId === session.id) {
        bookingOrderIndex.set(session.id, order.id)
        return { order: toManagedOrder(order), created: false }
      }
    }
  }

  const prepared = prepareBookingPayment({
    bookingSession: session,
    travelers: passengersFromSession(session),
    returnUrl: '/checkout/return',
  })

  // Rebuild cart with taxes for checkout review accuracy
  const baseCart = buildCart(prepared.checkoutInit.items, prepared.currency, null, 0)
  const taxedTotal = Math.round(baseCart.subtotal * (1 + TAX_RATE) * 100) / 100
  const cart = {
    ...baseCart,
    taxes: Math.round(baseCart.subtotal * TAX_RATE * 100) / 100,
    total: taxedTotal,
  }

  // Attach itinerary metadata onto first item for projections
  const itinerary = itineraryFromSession(session)
  if (cart.items[0] && itinerary) {
    cart.items[0] = {
      ...cart.items[0],
      metadata: {
        ...cart.items[0].metadata,
        selectedItinerary: itinerary,
        bookingReference: resolveBookingReference(session),
        bookingSessionId: session.id,
      },
    }
  }

  const order = createOrder({
    userId: input.userId,
    travelSessionId: session.travelSessionId,
    bookingSessionId: session.id,
    cart,
    travelers: prepared.checkoutInit.travelers,
    couponCode: null,
    discountAmount: 0,
  })

  // Move to awaiting payment
  updateOrderStatus(order.id, 'pending_payment')
  const pending = getOrder(order.id) ?? order
  bookingOrderIndex.set(session.id, pending.id)

  // Mirror link onto booking session metadata (no second SoT — just a pointer)
  const item = session.items[0]
  if (item) {
    orch.updateBookingItem(session.id, item.id, {
      metadata: {
        ...item.metadata,
        orderId: pending.id,
        orderNumber: pending.orderNumber,
        sprint: Math.max(Number(item.metadata.sprint ?? 0), 15),
      },
    })
  }

  await persistOrder(pending).catch((err) => {
    console.warn('[order] persistOrder failed (in-memory order retained)', err)
  })
  return { order: toManagedOrder(pending), created: true }
}

export function getManagedOrder(orderId: string): ManagedOrder | null {
  const order = getOrder(orderId)
  return order ? toManagedOrder(order) : null
}

export function listManagedOrdersForUser(userId: string): ManagedOrder[] {
  return listOrdersByUser(userId).map(toManagedOrder)
}

/** Alias — Concierge / docs prefer customer wording. */
export const listManagedOrdersForCustomer = listManagedOrdersForUser

/** Test helper */
export function clearBookingOrderIndex(): void {
  bookingOrderIndex.clear()
}
