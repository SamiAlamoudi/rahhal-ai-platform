import { describe, it, expect } from 'vitest'
import { orderFromRow, paymentSessionFromRow, orderToCreateInput, paymentSessionToCreateInput } from '../payment/checkoutPersistence'
import type { OrderRow, PaymentSessionRow } from '../payment/paymentRowTypes'
import type { RahhalOrder } from '../payment/checkoutTypes'
import type { PaymentSession } from '../payment/paymentTypes'

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
    description: 'Rahhal order',
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

    const session = paymentSessionFromRow(samplePaymentSessionRow()) as PaymentSession
    const sessionInput = paymentSessionToCreateInput(session)
    expect(sessionInput.id).toBe(session.id)
    expect(sessionInput.provider_id).toBe('moyasar')
    expect(sessionInput.amount).toBe(session.amount)
    expect((sessionInput.metadata as Record<string, unknown>).redirectUrl).toBe(session.redirectUrl)
  })
})
