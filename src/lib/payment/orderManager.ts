import type {
  RahhalOrder,
  OrderStatus,
  CheckoutCart,
  CheckoutItem,
  TravelerInfo,
} from './checkoutTypes'
import type { PaymentSession } from './paymentTypes'

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `ord_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

function generateOrderNumber(): string {
  const now = new Date()
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `RH-${ymd}-${rand}`
}

function generateBookingNumber(): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase()
  return `BK-${rand}`
}

function generateCustomerReference(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `CUST-${rand}`
}

export interface CreateOrderInput {
  userId: string
  travelSessionId: string | null
  cart: CheckoutCart
  travelers: TravelerInfo[]
  couponCode: string | null
  discountAmount: number
}

const orders: Map<string, RahhalOrder> = new Map()
const userOrders: Map<string, string[]> = new Map()

export function createOrder(input: CreateOrderInput): RahhalOrder {
  const now = new Date().toISOString()
  const order: RahhalOrder = {
    id: generateId(),
    orderNumber: generateOrderNumber(),
    bookingNumber: generateBookingNumber(),
    customerReference: generateCustomerReference(),
    userId: input.userId,
    travelSessionId: input.travelSessionId,
    status: 'created',
    cart: { ...input.cart, items: input.cart.items.map(i => ({ ...i, metadata: { ...i.metadata } })) },
    travelers: input.travelers.map(t => ({ ...t })),
    couponCode: input.couponCode,
    discountAmount: input.discountAmount,
    paymentSessionId: null,
    paymentProvider: null,
    paidAt: null,
    confirmedAt: null,
    invoiceNumber: null,
    itineraryId: null,
    createdAt: now,
    updatedAt: now,
  }
  orders.set(order.id, order)
  const userOrderIds = userOrders.get(input.userId) ?? []
  userOrderIds.push(order.id)
  userOrders.set(input.userId, userOrderIds)
  return { ...order, cart: { ...order.cart, items: order.cart.items.map(i => ({ ...i, metadata: { ...i.metadata } })) }, travelers: order.travelers.map(t => ({ ...t })) }
}

export function getOrder(orderId: string): RahhalOrder | null {
  const order = orders.get(orderId)
  if (!order) return null
  return cloneOrder(order)
}

export function getOrderByNumber(orderNumber: string): RahhalOrder | null {
  for (const order of orders.values()) {
    if (order.orderNumber === orderNumber) return cloneOrder(order)
  }
  return null
}

export function updateOrderStatus(orderId: string, status: OrderStatus): RahhalOrder | null {
  const order = orders.get(orderId)
  if (!order) return null
  order.status = status
  order.updatedAt = new Date().toISOString()
  if (status === 'paid') order.paidAt = order.paidAt ?? new Date().toISOString()
  if (status === 'confirmed') order.confirmedAt = order.confirmedAt ?? new Date().toISOString()
  return cloneOrder(order)
}

export function attachPaymentSession(orderId: string, paymentSession: PaymentSession): RahhalOrder | null {
  const order = orders.get(orderId)
  if (!order) return null
  order.paymentSessionId = paymentSession.id
  order.paymentProvider = paymentSession.providerId
  order.updatedAt = new Date().toISOString()
  return cloneOrder(order)
}

export function markOrderPaid(orderId: string, invoiceNumber: string): RahhalOrder | null {
  const order = orders.get(orderId)
  if (!order) return null
  order.status = 'paid'
  order.paidAt = new Date().toISOString()
  order.invoiceNumber = invoiceNumber
  order.updatedAt = new Date().toISOString()
  return cloneOrder(order)
}

export function markOrderConfirmed(orderId: string, itineraryId: string): RahhalOrder | null {
  const order = orders.get(orderId)
  if (!order) return null
  order.status = 'confirmed'
  order.confirmedAt = new Date().toISOString()
  order.itineraryId = itineraryId
  order.updatedAt = new Date().toISOString()
  return cloneOrder(order)
}

export function listOrdersByUser(userId: string): RahhalOrder[] {
  const ids = userOrders.get(userId) ?? []
  return ids
    .map(id => orders.get(id))
    .filter((o): o is RahhalOrder => o !== null)
    .map(cloneOrder)
}

export function listAllOrders(): RahhalOrder[] {
  return Array.from(orders.values()).map(cloneOrder)
}

export function clearAllOrders(): void {
  orders.clear()
  userOrders.clear()
}

function cloneOrder(order: RahhalOrder): RahhalOrder {
  return {
    ...order,
    cart: {
      ...order.cart,
      items: order.cart.items.map(i => ({ ...i, metadata: { ...i.metadata } })),
    },
    travelers: order.travelers.map(t => ({ ...t })),
  }
}

export function generateInvoiceNumber(_order: RahhalOrder): string {
  const year = new Date().getFullYear()
  const seq = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `INV-${year}-${seq}`
}

export function generateItineraryId(order: RahhalOrder): string {
  return `ITIN-${order.orderNumber}`
}

export function buildCart(items: CheckoutItem[], currency: string, _couponCode: string | null, discountAmount: number): CheckoutCart {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0)
  const taxes = Math.round(subtotal * 0.15 * 100) / 100
  const fees = 0
  const total = subtotal + taxes + fees - discountAmount
  return {
    items: items.map(i => ({ ...i, metadata: { ...i.metadata } })),
    subtotal,
    taxes,
    fees,
    discount: discountAmount,
    total,
    currency,
  }
}
