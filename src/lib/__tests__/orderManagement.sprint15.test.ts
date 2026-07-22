/**
 * Sprint 15 — Order Management Engine + Payment Preparation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLocalBookingSessions,
  getBookingOrchestrator,
  persistBookingSession,
  resetBookingOrchestrator,
} from '../booking'
import { startConfirmation } from '../bookingConfirmation'
import { resetSupplierAdapterRegistry } from '../supplierAdapters'
import { clearAllOrders } from '../payment/orderManager'
import {
  buildCheckoutReviewModel,
  buildOrderTimeline,
  clearBookingOrderIndex,
  clearPaymentSessionStore,
  createOrderFromBooking,
  createPaymentSessionForOrder,
  DuplicatePaymentAttemptError,
  expirePaymentSession,
  findManagedOrderBySessionId,
  getPaymentGateway,
  listPaymentGateways,
  markMockPaymentPaid,
  resumePaymentSession,
  retryPaymentSession,
  buildOrderConciergeReply,
} from '../orderManagement'
import { extractFromUserText } from '../agent/extractRequirements'
import { createTravelAgentService } from '../agent/travelAgentService'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import type { ChatMessage } from '../chat/chatTypes'

function installMemoryLocalStorage(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    get length() {
      return store.size
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  })
}

/**
 * Soft-fail persistence awaits real Supabase `fetch` against example.supabase.co.
 * DNS usually rejects quickly (ENOTFOUND), but under CI load a stalled lookup can
 * leave the promise pending past Vitest's 5s testTimeout. Reject immediately so
 * offline soft-fail paths complete without hanging.
 */
function stubOfflineFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
  )
}

function resetOrderManagementTestState(): void {
  installMemoryLocalStorage()
  stubOfflineFetch()
  clearLocalBookingSessions()
  resetBookingOrchestrator()
  resetSupplierAdapterRegistry()
  clearAllOrders()
  clearBookingOrderIndex()
  clearPaymentSessionStore()
}

async function seedSession(userId = 'user-s15') {
  const orch = getBookingOrchestrator()
  const session = orch.createBookingSession({
    userId,
    travelSessionId: null,
    currency: 'SAR',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  })
  orch.addBookingItem(session.id, {
    type: 'flight',
    providerId: 'amadeus',
    providerName: 'Amadeus',
    providerOfferId: 'offer-s15',
    title: 'RUH → DXB',
    price: 1000,
    currency: 'SAR',
    bookingUrl: 'https://example.com/book',
    expiresAt: null,
    travelerSummary: 'adults:1|children:0|infants:0|total:1',
    metadata: {
      sprint: 14,
      selectedItinerary: {
        origin: 'RUH',
        destination: 'DXB',
        departureTime: '2026-12-10T08:00:00',
        arrivalTime: '2026-12-10T11:00:00',
        airline: 'Saudia',
        cabin: 'economy',
        stops: 0,
      },
      pricing: { fare: 1000, taxes: 150, fees: 0, grandTotal: 1150, currency: 'SAR' },
      passengers: [
        {
          id: 'p1',
          type: 'adult',
          firstName: 'Omar',
          lastName: 'Ali',
          title: 'mr',
          gender: 'male',
          dateOfBirth: '1990-01-01',
          nationality: 'SA',
          passportNumber: 'P99999',
          passportExpiry: '2030-01-01',
          passportIssuingCountry: 'SA',
          email: 'omar@example.com',
          mobileNumber: '+966500000000',
          emergencyContact: '',
          specialAssistance: '',
          mealPreference: '',
          frequentFlyerNumber: '',
        },
      ],
      passengersComplete: true,
      bookingPayload: { kind: 'flight_selection', offerId: 'offer-s15' },
    },
  })
  const live = orch.getBookingSession(session.id)!
  await persistBookingSession(live)
  return live
}

describe('Sprint 15 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  it('registers order_management / checkout_review / payment_preparation', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('ui.order_management')).toBe(true)
    expect(registry.isEnabled('ui.checkout_review')).toBe(true)
    expect(registry.isEnabled('ui.payment_preparation')).toBe(true)
    registry.setEnabled('ui.order_management', false)
    expect(registry.isEnabled('ui.checkout_review')).toBe(false)
    expect(registry.isEnabled('ui.payment_preparation')).toBe(false)
  })
})

describe('Sprint 15 order lifecycle', () => {
  beforeEach(() => {
    resetOrderManagementTestState()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates an order from a confirmed booking and reuses on second call', async () => {
    const session = await seedSession()
    await startConfirmation({ sessionId: session.id, userId: 'user-s15' })

    const first = await createOrderFromBooking({
      bookingSessionId: session.id,
      userId: 'user-s15',
    })
    expect(first.created).toBe(true)
    expect(first.order.bookingSessionId).toBe(session.id)
    expect(first.order.orderStatus).toBe('awaiting_payment')
    expect(first.order.passengers.length).toBe(1)
    expect(first.order.itinerary?.origin).toBe('RUH')
    expect(first.order.totalAmount).toBeGreaterThan(0)
    expect(first.order.checkoutPath).toContain(first.order.orderId)

    const second = await createOrderFromBooking({
      bookingSessionId: session.id,
      userId: 'user-s15',
    })
    expect(second.created).toBe(false)
    expect(second.order.orderId).toBe(first.order.orderId)
    expect(findManagedOrderBySessionId(session.id)?.orderId).toBe(first.order.orderId)
  })

  it('builds order timeline with booking → order → payment stages', async () => {
    const session = await seedSession('user-tl')
    const confirmed = await startConfirmation({ sessionId: session.id, userId: 'user-tl' })
    const { order } = await createOrderFromBooking({
      bookingSessionId: session.id,
      userId: 'user-tl',
    })
    const events = buildOrderTimeline({ order, confirmation: confirmed.state })
    const types = events.map((e) => e.type)
    expect(types).toContain('booking_created')
    expect(types).toContain('booking_confirmed')
    expect(types).toContain('order_created')
    expect(types).toContain('awaiting_payment')
  })
})

describe('Sprint 15 checkout review', () => {
  beforeEach(() => {
    resetOrderManagementTestState()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('projects fare, passengers, conditions, and concierge summary', async () => {
    const session = await seedSession('user-co')
    await startConfirmation({ sessionId: session.id, userId: 'user-co' })
    const { order } = await createOrderFromBooking({
      bookingSessionId: session.id,
      userId: 'user-co',
    })
    const model = buildCheckoutReviewModel(order)
    expect(model.flightSummary).toMatch(/RUH/)
    expect(model.passengerLines[0]).toMatch(/Omar/)
    expect(model.taxes).toBeTruthy()
    expect(model.fees).toBeTruthy()
    expect(model.total).toBeTruthy()
    expect(model.cancellationPolicy).toMatch(/Cancellation/i)
    expect(model.bookingConditions.length).toBeGreaterThan(0)
    expect(model.conciergeSummary).toMatch(/Checkout/i)
  })
})

describe('Sprint 15 payment preparation + sessions', () => {
  beforeEach(() => {
    resetOrderManagementTestState()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exposes mock gateway and future stubs', () => {
    const ids = listPaymentGateways().map((g) => g.gatewayId)
    expect(ids).toEqual(expect.arrayContaining([
      'mock',
      'stripe',
      'hyperpay',
      'moyasar',
      'tabby',
      'tamara',
    ]))
    expect(getPaymentGateway('mock').getCapabilities().mocked).toBe(true)
    expect(getPaymentGateway('stripe').getCapabilities().mocked).toBe(true)
  })

  it('creates, resumes, expires, and retries payment sessions without duplicates', async () => {
    const session = await seedSession('user-pay')
    await startConfirmation({ sessionId: session.id, userId: 'user-pay' })
    const { order } = await createOrderFromBooking({
      bookingSessionId: session.id,
      userId: 'user-pay',
    })

    const created = await createPaymentSessionForOrder({
      orderId: order.orderId,
      userId: 'user-pay',
    })
    expect(created.ok).toBe(true)
    expect(created.resumed).toBe(false)
    expect(created.session?.status).toBe('pending')

    const resumed = await createPaymentSessionForOrder({
      orderId: order.orderId,
      userId: 'user-pay',
    })
    expect(resumed.resumed).toBe(true)
    expect(resumed.session?.id).toBe(created.session?.id)

    await expect(
      createPaymentSessionForOrder({
        orderId: order.orderId,
        userId: 'user-pay',
        rejectDuplicate: true,
      }),
    ).rejects.toBeInstanceOf(DuplicatePaymentAttemptError)

    const viaResume = await resumePaymentSession(order.orderId, 'user-pay')
    expect(viaResume.session?.id).toBe(created.session?.id)

    expirePaymentSession(created.session!.id)
    const retried = await retryPaymentSession(order.orderId, 'user-pay')
    expect(retried.ok).toBe(true)
    expect(retried.session?.id).not.toBe(created.session?.id)

    const paid = await markMockPaymentPaid(retried.session!.id)
    expect(paid.ok).toBe(true)
    expect(paid.order?.orderStatus).toBe('paid')
    expect(paid.order?.paymentStatus).toBe('paid')
  })
})

describe('Sprint 15 concierge order/payment intents', () => {
  beforeEach(() => {
    resetOrderManagementTestState()
    resetFeatureRegistry()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('detects order and payment questions', () => {
    expect(extractFromUserText('How much will I pay?', 'en').intent).toBe('how_much_will_i_pay')
    expect(extractFromUserText('Is my order ready?', 'en').intent).toBe('is_order_ready')
    expect(extractFromUserText('Show my checkout', 'en').intent).toBe('show_checkout')
    expect(extractFromUserText('What is my payment status?', 'en').intent).toBe('what_is_payment_status')
  })

  it('answers via buildOrderConciergeReply helpers', async () => {
    const session = await seedSession('user-ai')
    await startConfirmation({ sessionId: session.id, userId: 'user-ai' })
    const { order } = await createOrderFromBooking({
      bookingSessionId: session.id,
      userId: 'user-ai',
    })

    expect(buildOrderConciergeReply('how_much_will_i_pay', { order })).toMatch(/totals/i)
    expect(buildOrderConciergeReply('is_order_ready', { order })).toMatch(/ready/i)
    expect(buildOrderConciergeReply('show_checkout', { order })).toMatch(/Checkout/i)
    expect(buildOrderConciergeReply('what_is_payment_status', { order })).toMatch(/Payment status/i)
  })

  it('travel agent answers payment questions when order exists', async () => {
    const session = await seedSession('user-agent')
    await startConfirmation({ sessionId: session.id, userId: 'user-agent' })
    await createOrderFromBooking({ bookingSessionId: session.id, userId: 'user-agent' })

    const service = createTravelAgentService({
      concierge: false,
      listBookingRecords: async () => {
        const live = getBookingOrchestrator().getBookingSession(session.id)!
        const { toBookingRecord } = await import('../booking')
        return [toBookingRecord(live)]
      },
    })

    const messages: ChatMessage[] = [{
      id: 'm1',
      conversationId: 'c-s15',
      role: 'user',
      modality: 'text',
      content: 'How much will I pay?',
      audioUrl: null,
      imageUrl: null,
      attachments: [],
      status: 'complete',
      error: null,
      providerMeta: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }]
    const turn = await service.planTurn({ conversationId: 'c-s15', messages })
    expect(turn.memory.lastIntent).toBe('how_much_will_i_pay')
    expect(turn.reply).toMatch(/order|total|pay/i)
  })
})
