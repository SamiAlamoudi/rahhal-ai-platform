import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  orderFromRow,
  paymentSessionFromRow,
  orderToCreateInput,
  paymentSessionToCreateInput,
  createCheckoutSession,
  getCheckoutSession,
  updateCheckoutSession,
} from '../payment/checkoutPersistence'
import type { OrderRow, PaymentSessionRow, BookingLockRow } from '../payment/paymentRowTypes'
import type { RahhalOrder } from '../payment/checkoutTypes'
import type { PaymentSession } from '../payment/paymentTypes'
import type { BookingLock } from '../payment/bookingLock'
import { orderRepository } from '../repositories/orderRepository'
import {
  paymentSessionRepository,
  paymentEventRepository,
} from '../repositories/paymentSessionRepository'
import { bookingLockRepository } from '../repositories/bookingLockRepository'
import { clearAllOrders } from '../payment/orderManager'

function sampleOrderRow(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: 'ord-1',
    user_id: 'user-1',
    travel_session_id: null,
    order_number: 'RH-20260714-ABC12',
    booking_number: 'BK-ABCDEF12',
    customer_reference: 'CUST-XYZ',
    status: 'pending_payment',
    cart: {
      items: [{ id: 'item-1', type: 'flight', title: 'Flight', price: 1000, currency: 'SAR' }],
      subtotal: 1000,
      taxes: 150,
      fees: 25,
      discount: 0,
      total: 1175,
      currency: 'SAR',
    },
    travelers: { list: [{ fullName: 'Test Traveler', email: 't@example.com' }] },
    coupon_code: null,
    discount_amount: 0,
    payment_session_id: null,
    payment_provider: null,
    paid_at: null,
    confirmed_at: null,
    invoice_number: null,
    itinerary_id: null,
    created_at: '2026-07-14T10:00:00.000Z',
    updated_at: '2026-07-14T10:00:00.000Z',
    ...overrides,
  }
}

function samplePaymentSessionRow(overrides: Partial<PaymentSessionRow> = {}): PaymentSessionRow {
  return {
    id: 'pay-1',
    user_id: 'user-1',
    order_id: 'ord-1',
    order_number: 'RH-20260714-ABC12',
    provider_id: 'moyasar',
    status: 'pending',
    amount: 1175,
    currency: 'SAR',
    payment_method: null,
    provider_reference: 'moy_abc',
    authorization_code: null,
    transaction_id: null,
    description: 'Bilamo order',
    customer_email: 't@example.com',
    customer_name: 'Test',
    metadata: {
      redirectUrl: 'https://example.com/pay',
      providerReference: 'moy_abc',
    },
    paid_at: null,
    expires_at: '2026-07-14T11:00:00.000Z',
    created_at: '2026-07-14T10:00:00.000Z',
    updated_at: '2026-07-14T10:00:00.000Z',
    ...overrides,
  }
}

function sampleOrder(): RahhalOrder {
  return orderFromRow(sampleOrderRow({
    status: 'created',
    cart: {
      items: [
        {
          id: 'flt-1',
          type: 'flight',
          providerId: 'amadeus',
          providerName: 'Amadeus',
          providerOfferId: 'OF1',
          title: 'RUH → TYO',
          price: 4200,
          currency: 'SAR',
          bookingUrl: '',
          expiresAt: null,
          travelerSummary: '2 adults',
          metadata: {},
        },
        {
          id: 'htl-1',
          type: 'hotel',
          providerId: 'booking',
          providerName: 'Booking.com',
          providerOfferId: 'HT1',
          title: 'Tokyo Hotel',
          price: 5500,
          currency: 'SAR',
          bookingUrl: '',
          expiresAt: null,
          travelerSummary: '1 room',
          metadata: {},
        },
      ],
      subtotal: 9700,
      taxes: 1455,
      fees: 0,
      discount: 0,
      total: 11155,
      currency: 'SAR',
    },
  }))
}

function sampleLock(): BookingLock {
  return {
    id: 'lock-1',
    orderId: 'ord-1',
    userId: 'user-1',
    status: 'active',
    lockToken: 'tok-abc',
    createdAt: '2026-07-14T10:00:00.000Z',
    expiresAt: '2026-07-14T10:15:00.000Z',
    releasedAt: null,
  }
}

describe('checkoutPersistence mappers', () => {
  it('orderFromRow maps cart and travelers', () => {
    const order = orderFromRow(sampleOrderRow())
    expect(order.id).toBe('ord-1')
    expect(order.orderNumber).toBe('RH-20260714-ABC12')
    expect(order.cart.total).toBe(1175)
    expect(order.cart.currency).toBe('SAR')
    expect(order.travelers).toHaveLength(1)
    expect(order.status).toBe('pending_payment')
  })

  it('orderFromRow accepts travelers array shape', () => {
    const order = orderFromRow(sampleOrderRow({
      travelers: [{ fullName: 'A' }] as unknown as Record<string, unknown>,
    }))
    expect(order.travelers).toHaveLength(1)
  })

  it('paymentSessionFromRow reads metadata fallbacks', () => {
    const session = paymentSessionFromRow(samplePaymentSessionRow({
      provider_reference: null,
      payment_method: null,
    }))
    expect(session.providerId).toBe('moyasar')
    expect(session.providerReference).toBe('moy_abc')
    expect(session.redirectUrl).toBe('https://example.com/pay')
    expect(session.amount).toBe(1175)
  })

  it('orderToCreateInput / paymentSessionToCreateInput round-trip key fields', () => {
    const order = orderFromRow(sampleOrderRow()) as RahhalOrder
    const createInput = orderToCreateInput(order)
    expect(createInput.order_number).toBe(order.orderNumber)
    expect(createInput.status).toBe(order.status)
    expect(createInput.discount_amount).toBe(order.discountAmount)
    expect(createInput.id).toBe(order.id)

    const session = paymentSessionFromRow(samplePaymentSessionRow()) as PaymentSession
    const sessionInput = paymentSessionToCreateInput(session)
    expect(sessionInput.id).toBe(session.id)
    expect(sessionInput.provider_id).toBe('moyasar')
    expect(sessionInput.amount).toBe(session.amount)
    expect((sessionInput.metadata as Record<string, unknown>).redirectUrl).toBe(session.redirectUrl)
  })
})

describe('checkout session create / retrieve / update APIs', () => {
  beforeEach(() => {
    clearAllOrders()
    vi.spyOn(orderRepository, 'create').mockResolvedValue(sampleOrderRow({ status: 'created' }))
    vi.spyOn(orderRepository, 'update').mockImplementation(async (id, updates) =>
      sampleOrderRow({ id, ...updates } as Partial<OrderRow>),
    )
    vi.spyOn(orderRepository, 'getById').mockResolvedValue(sampleOrderRow({ status: 'created' }))
    vi.spyOn(bookingLockRepository, 'create').mockResolvedValue({
      id: 'lock-1',
      user_id: 'user-1',
      order_id: 'ord-1',
      lock_token: 'tok-abc',
      status: 'active',
      expires_at: '2026-07-14T10:15:00.000Z',
      released_at: null,
      created_at: '2026-07-14T10:00:00.000Z',
    } as BookingLockRow)
    vi.spyOn(bookingLockRepository, 'getActiveByOrderId').mockResolvedValue(null)
    vi.spyOn(paymentSessionRepository, 'update').mockResolvedValue(samplePaymentSessionRow())
    vi.spyOn(paymentEventRepository, 'create').mockResolvedValue({
      id: 'evt-1',
      user_id: 'user-1',
      payment_session_id: 'pay-1',
      event_type: 'status_changed',
      from_status: 'pending',
      to_status: 'authorized',
      details: {},
      created_at: '2026-07-14T10:00:00.000Z',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('createCheckoutSession persists order with itinerary cart and optional lock', async () => {
    const order = sampleOrder()
    const lock = sampleLock()

    const session = await createCheckoutSession(order, lock)

    expect(orderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: order.id,
        order_number: order.orderNumber,
        status: order.status,
      }),
    )
    expect(bookingLockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: lock.id,
        order_id: order.id,
        lock_token: lock.lockToken,
      }),
    )
    expect(session.cart.items).toHaveLength(2)
    expect(session.cart.items.map((i) => i.type)).toEqual(['flight', 'hotel'])
    expect(session.lockToken).toBe('tok-abc')
    expect(session.paymentSession).toBeNull()
  })

  it('getCheckoutSession retrieves order, payment session, and active lock', async () => {
    vi.mocked(orderRepository.getById).mockResolvedValue(sampleOrderRow({
      payment_session_id: 'pay-1',
      status: 'pending_payment',
    }))
    vi.spyOn(paymentSessionRepository, 'getById').mockResolvedValue(samplePaymentSessionRow())
    vi.mocked(bookingLockRepository.getActiveByOrderId).mockResolvedValue({
      id: 'lock-1',
      user_id: 'user-1',
      order_id: 'ord-1',
      lock_token: 'tok-abc',
      status: 'active',
      expires_at: '2026-07-14T10:15:00.000Z',
      released_at: null,
      created_at: '2026-07-14T10:00:00.000Z',
    } as BookingLockRow)

    const session = await getCheckoutSession('ord-1')

    expect(session).not.toBeNull()
    expect(session!.order.id).toBe('ord-1')
    expect(session!.order.cart.total).toBe(1175)
    expect(session!.paymentSession?.id).toBe('pay-1')
    expect(session!.lockToken).toBe('tok-abc')
  })

  it('getCheckoutSession returns null when order is missing', async () => {
    vi.mocked(orderRepository.getById).mockResolvedValue(null)
    const session = await getCheckoutSession('missing')
    expect(session).toBeNull()
  })

  it('updateCheckoutSession syncs order itinerary/status and payment session', async () => {
    const order = sampleOrder()
    order.status = 'pending_payment'
    order.paymentSessionId = 'pay-1'
    const paymentSession = paymentSessionFromRow(samplePaymentSessionRow({ status: 'authorized' }))

    const session = await updateCheckoutSession(order, paymentSession, 'pending')

    expect(orderRepository.update).toHaveBeenCalledWith(
      order.id,
      expect.objectContaining({
        status: 'pending_payment',
        payment_session_id: 'pay-1',
      }),
    )
    expect(paymentSessionRepository.update).toHaveBeenCalledWith(
      'pay-1',
      expect.objectContaining({ status: 'authorized' }),
    )
    expect(paymentEventRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_session_id: 'pay-1',
        from_status: 'pending',
        to_status: 'authorized',
      }),
    )
    expect(session.order.status).toBe('pending_payment')
    expect(session.paymentSession?.status).toBe('authorized')
  })
})
