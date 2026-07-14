import { describe, it, expect, beforeEach } from 'vitest'
import {
  createOrder,
  getOrder,
  getOrderByNumber,
  updateOrderStatus,
  listOrdersByUser,
  listAllOrders,
  clearAllOrders,
  buildCart,
} from '../payment/orderManager'
import { generateInvoice } from '../payment/invoiceGenerator'
import { generateItinerary } from '../payment/itineraryGenerator'
import type { CheckoutItem, TravelerInfo } from '../payment/checkoutTypes'
import type { InvoiceLine } from '../payment/invoiceGenerator'
import { clearAllLocks } from '../payment/bookingLock'
import { clearCoupons } from '../payment/couponValidator'

function sampleItem(overrides: Partial<CheckoutItem> = {}): CheckoutItem {
  return {
    id: 'item-1',
    type: 'flight',
    providerId: 'amadeus-1',
    providerName: 'Amadeus',
    providerOfferId: 'offer-1',
    title: 'JAL 462: RUH → NRT',
    price: 5500,
    currency: 'SAR',
    bookingUrl: 'https://example.com/book',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    travelerSummary: '2 adults',
    metadata: {},
    ...overrides,
  }
}

function sampleTraveler(overrides: Partial<TravelerInfo> = {}): TravelerInfo {
  return {
    id: 't1',
    firstName: 'Ahmed',
    lastName: 'Al-Saud',
    dateOfBirth: null,
    passportNumber: 'A12345678',
    passportExpiry: null,
    nationality: 'Saudi',
    type: 'adult',
    ...overrides,
  }
}

// ── Order Manager Tests ──────────────────────────────────────────────────────

describe('OrderManager', () => {
  beforeEach(() => {
    clearAllOrders()
    clearAllLocks()
    clearCoupons()
  })

  it('creates an order with unique numbers', () => {
    const order = createOrder({
      userId: 'user-1',
      travelSessionId: null,
      cart: buildCart([sampleItem()], 'SAR', null, 0),
      travelers: [sampleTraveler()],
      couponCode: null,
      discountAmount: 0,
    })
    expect(order.id).toBeTruthy()
    expect(order.orderNumber).toMatch(/^RH-/)
    expect(order.bookingNumber).toMatch(/^BK-/)
    expect(order.customerReference).toMatch(/^CUST-/)
    expect(order.status).toBe('created')
  })

  it('generates unique order numbers for different orders', () => {
    const o1 = createOrder({ userId: 'u1', travelSessionId: null, cart: buildCart([sampleItem()], 'SAR', null, 0), travelers: [], couponCode: null, discountAmount: 0 })
    const o2 = createOrder({ userId: 'u1', travelSessionId: null, cart: buildCart([sampleItem()], 'SAR', null, 0), travelers: [], couponCode: null, discountAmount: 0 })
    expect(o1.orderNumber).not.toBe(o2.orderNumber)
    expect(o1.bookingNumber).not.toBe(o2.bookingNumber)
  })

  it('retrieves order by id', () => {
    const order = createOrder({ userId: 'u1', travelSessionId: null, cart: buildCart([sampleItem()], 'SAR', null, 0), travelers: [], couponCode: null, discountAmount: 0 })
    const retrieved = getOrder(order.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe(order.id)
  })

  it('retrieves order by order number', () => {
    const order = createOrder({ userId: 'u1', travelSessionId: null, cart: buildCart([sampleItem()], 'SAR', null, 0), travelers: [], couponCode: null, discountAmount: 0 })
    const retrieved = getOrderByNumber(order.orderNumber)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.orderNumber).toBe(order.orderNumber)
  })

  it('returns null for non-existent order', () => {
    expect(getOrder('non-existent')).toBeNull()
    expect(getOrderByNumber('NON-EXIST')).toBeNull()
  })

  it('updates order status', () => {
    const order = createOrder({ userId: 'u1', travelSessionId: null, cart: buildCart([sampleItem()], 'SAR', null, 0), travelers: [], couponCode: null, discountAmount: 0 })
    const updated = updateOrderStatus(order.id, 'pending_payment')
    expect(updated!.status).toBe('pending_payment')
  })

  it('sets paidAt when status becomes paid', () => {
    const order = createOrder({ userId: 'u1', travelSessionId: null, cart: buildCart([sampleItem()], 'SAR', null, 0), travelers: [], couponCode: null, discountAmount: 0 })
    const updated = updateOrderStatus(order.id, 'paid')
    expect(updated!.paidAt).not.toBeNull()
  })

  it('lists orders by user', () => {
    createOrder({ userId: 'u1', travelSessionId: null, cart: buildCart([sampleItem()], 'SAR', null, 0), travelers: [], couponCode: null, discountAmount: 0 })
    createOrder({ userId: 'u1', travelSessionId: null, cart: buildCart([sampleItem()], 'SAR', null, 0), travelers: [], couponCode: null, discountAmount: 0 })
    createOrder({ userId: 'u2', travelSessionId: null, cart: buildCart([sampleItem()], 'SAR', null, 0), travelers: [], couponCode: null, discountAmount: 0 })
    const u1Orders = listOrdersByUser('u1')
    expect(u1Orders.length).toBe(2)
  })

  it('lists all orders', () => {
    createOrder({ userId: 'u1', travelSessionId: null, cart: buildCart([sampleItem()], 'SAR', null, 0), travelers: [], couponCode: null, discountAmount: 0 })
    createOrder({ userId: 'u2', travelSessionId: null, cart: buildCart([sampleItem()], 'SAR', null, 0), travelers: [], couponCode: null, discountAmount: 0 })
    expect(listAllOrders().length).toBe(2)
  })
})

// ── Cart Builder Tests ───────────────────────────────────────────────────────

describe('buildCart', () => {
  it('calculates subtotal, taxes, and total', () => {
    const items = [sampleItem({ price: 5000 }), sampleItem({ id: 'item-2', price: 1000 })]
    const cart = buildCart(items, 'SAR', null, 0)
    expect(cart.subtotal).toBe(6000)
    expect(cart.taxes).toBe(900)
    expect(cart.fees).toBe(0)
    expect(cart.discount).toBe(0)
    expect(cart.total).toBe(6900)
  })

  it('applies discount to total', () => {
    const cart = buildCart([sampleItem({ price: 5000 })], 'SAR', 'SAVE10', 500)
    expect(cart.discount).toBe(500)
    expect(cart.total).toBe(5000 + 750 - 500)
  })
})

// ── Invoice Generator Tests ──────────────────────────────────────────────────

describe('InvoiceGenerator', () => {
  beforeEach(() => {
    clearAllOrders()
  })

  it('generates invoice with line items', () => {
    const order = createOrder({ userId: 'u1', travelSessionId: null, cart: buildCart([sampleItem()], 'SAR', null, 0), travelers: [], couponCode: null, discountAmount: 0 })
    updateOrderStatus(order.id, 'paid')
    const paid = getOrder(order.id)!
    const invoice = generateInvoice(paid)
    expect(invoice.invoiceNumber).toBeTruthy()
    expect(invoice.lines.length).toBeGreaterThan(0)
    expect(invoice.lines.some((l: InvoiceLine) => l.type === 'item')).toBe(true)
    expect(invoice.lines.some((l: InvoiceLine) => l.type === 'tax')).toBe(true)
    expect(invoice.lines.some((l: InvoiceLine) => l.type === 'total')).toBe(true)
  })

  it('includes discount line when discount > 0', () => {
    const order = createOrder({ userId: 'u1', travelSessionId: null, cart: buildCart([sampleItem()], 'SAR', 'CODE', 100), travelers: [], couponCode: 'CODE', discountAmount: 100 })
    const invoice = generateInvoice(order)
    expect(invoice.lines.some((l: InvoiceLine) => l.type === 'discount')).toBe(true)
  })
})

// ── Itinerary Generator Tests ────────────────────────────────────────────────

describe('ItineraryGenerator', () => {
  beforeEach(() => {
    clearAllOrders()
  })

  it('generates itinerary with segments', () => {
    const order = createOrder({ userId: 'u1', travelSessionId: null, cart: buildCart([sampleItem(), sampleItem({ id: 'i2', type: 'hotel', title: 'Hilton Tokyo' })], 'SAR', null, 0), travelers: [sampleTraveler()], couponCode: null, discountAmount: 0 })
    const itinerary = generateItinerary(order)
    expect(itinerary.segments.length).toBe(2)
    expect(itinerary.travelers.length).toBe(1)
    expect(itinerary.orderNumber).toBe(order.orderNumber)
  })
})
