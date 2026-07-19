/**
 * Sprint 14 — Booking Confirmation Engine + Supplier Adapters.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLocalBookingSessions,
  getBookingOrchestrator,
  persistBookingSession,
  resetBookingOrchestrator,
} from '../booking'
import {
  buildConfirmationConciergeReply,
  buildConfirmationTimeline,
  confirmationStateFromSession,
  generateConfirmationReference,
  retryConfirmation,
  startConfirmation,
} from '../bookingConfirmation'
import {
  createAmadeusBookingConfirmationAdapter,
  getSupplierAdapter,
  listSupplierAdapters,
  resetSupplierAdapterRegistry,
} from '../supplierAdapters'
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

async function seedSession(userId = 'user-s14') {
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
    providerOfferId: 'offer-s14',
    title: 'RUH → DXB',
    price: 1200,
    currency: 'SAR',
    bookingUrl: 'https://example.com/book',
    expiresAt: null,
    travelerSummary: 'adults:1|children:0|infants:0|total:1',
    metadata: {
      sprint: 13,
      selectedItinerary: {
        origin: 'RUH',
        destination: 'DXB',
        departureTime: '2026-12-10T08:00:00',
        arrivalTime: '2026-12-10T11:00:00',
        airline: 'Saudia',
        cabin: 'economy',
        stops: 0,
      },
      pricing: { fare: 1200, taxes: 180, fees: 0, grandTotal: 1380, currency: 'SAR' },
      passengers: [
        {
          id: 'p1',
          type: 'adult',
          firstName: 'Sara',
          lastName: 'Hassan',
          title: 'ms',
          gender: 'female',
          dateOfBirth: '1992-02-02',
          nationality: 'SA',
          passportNumber: 'P12345',
          passportExpiry: '2031-01-01',
          passportIssuingCountry: 'SA',
          email: 'sara@example.com',
          mobileNumber: '+966501111111',
          emergencyContact: '',
          specialAssistance: '',
          mealPreference: '',
          frequentFlyerNumber: '',
        },
      ],
      passengersComplete: true,
      bookingPayload: { kind: 'flight_selection', offerId: 'offer-s14' },
    },
  })
  const live = orch.getBookingSession(session.id)!
  await persistBookingSession(live)
  return live
}

describe('Sprint 14 confirmation references & timeline', () => {
  it('generates production-ready confirmation references', () => {
    expect(generateConfirmationReference('abc-12345678')).toMatch(/^RHL-CONF-[A-Z0-9]+$/)
  })

  it('builds timeline including ticket-pending and completed', () => {
    const events = buildConfirmationTimeline({
      createdAt: '2026-07-01T00:00:00.000Z',
      status: 'confirmed',
      pendingAt: '2026-07-01T01:00:00.000Z',
      confirmingAt: '2026-07-01T01:05:00.000Z',
      confirmedAt: '2026-07-01T01:06:00.000Z',
      ticketPending: true,
    })
    const types = events.map((e) => e.type)
    expect(types).toContain('booking_created')
    expect(types).toContain('waiting_for_supplier')
    expect(types).toContain('supplier_confirmed')
    expect(types).toContain('ticket_pending')
  })
})

describe('Sprint 14 supplier adapters', () => {
  beforeEach(() => {
    resetSupplierAdapterRegistry()
  })

  it('registers Amadeus as active and stubs for future suppliers', () => {
    const ids = listSupplierAdapters().map((a) => a.supplierId)
    expect(ids).toContain('amadeus')
    expect(ids).toContain('duffel')
    expect(ids).toContain('travelport')
    expect(ids).toContain('sabre')
    expect(getSupplierAdapter('amadeus').getCapabilities().supportsFlightConfirmation).toBe(true)
    expect(getSupplierAdapter('duffel').getCapabilities().supportsFlightConfirmation).toBe(false)
  })

  it('Amadeus adapter confirms deterministically', async () => {
    const adapter = createAmadeusBookingConfirmationAdapter()
    const ok = await adapter.confirmBooking({
      sessionId: 'sess-1',
      offerId: 'off',
      bookingPayload: null,
      passengers: [],
      currency: 'SAR',
      amount: 100,
      temporaryReference: 'RHL-TEST',
    })
    expect(ok.success).toBe(true)
    expect(ok.supplierReference).toMatch(/^AMA-/)

    const fail = await adapter.confirmBooking({
      sessionId: 'sess-1',
      offerId: 'off',
      bookingPayload: null,
      passengers: [],
      currency: 'SAR',
      amount: 100,
      temporaryReference: 'RHL-TEST',
      forceFail: true,
    })
    expect(fail.success).toBe(false)
  })
})

describe('Sprint 14 confirmation lifecycle', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
    clearLocalBookingSessions()
    resetBookingOrchestrator()
    resetSupplierAdapterRegistry()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('confirms a booking via engine + Amadeus adapter', async () => {
    const session = await seedSession()
    const result = await startConfirmation({
      sessionId: session.id,
      userId: 'user-s14',
    })
    expect(result.ok).toBe(true)
    expect(result.state.status).toBe('confirmed')
    expect(result.state.confirmedAt).toBeTruthy()
    expect(result.state.confirmationReference).toBeTruthy()
    expect(result.state.events.some((e) => e.type === 'supplier_confirmed')).toBe(true)

    const live = getBookingOrchestrator().getBookingSession(session.id)!
    expect(live.status).toBe('confirmed')
    expect(live.confirmedAt).toBeTruthy()
    expect(confirmationStateFromSession(live).status).toBe('confirmed')
  })

  it('marks failed and supports retry', async () => {
    const session = await seedSession('user-fail')
    const failed = await startConfirmation({
      sessionId: session.id,
      userId: 'user-fail',
      forceFail: true,
    })
    expect(failed.ok).toBe(false)
    expect(failed.state.status).toBe('failed')
    expect(getBookingOrchestrator().getBookingSession(session.id)?.status).toBe('failed')

    const retried = await retryConfirmation({
      sessionId: session.id,
      userId: 'user-fail',
    })
    expect(retried.ok).toBe(true)
    expect(retried.state.status).toBe('confirmed')
  })
})

describe('Sprint 14 concierge confirmation intents', () => {
  it('answers confirmation queries with consultant voice', () => {
    const state = {
      status: 'confirmed' as const,
      confirmationReference: 'AMA-ABC123',
      sessionId: 's1',
      supplierId: 'amadeus',
      supplierReference: 'AMA-ABC123',
      events: [],
      pendingAt: null,
      confirmingAt: null,
      confirmedAt: '2026-07-01T00:00:00.000Z',
      failedAt: null,
      cancelledAt: null,
      lastError: null,
      ticketPending: true,
    }
    expect(buildConfirmationConciergeReply({
      intent: 'booking_confirmed',
      state,
      locale: 'en',
    })).toMatch(/confirmed/i)

    expect(buildConfirmationConciergeReply({
      intent: 'booking_reference',
      state,
      locale: 'en',
    })).toMatch(/AMA-ABC123/)

    expect(buildConfirmationConciergeReply({
      intent: 'booking_status',
      state,
      locale: 'en',
    })).toMatch(/status/i)

    expect(buildConfirmationConciergeReply({
      intent: 'show_confirmation',
      state,
      locale: 'en',
    })).toMatch(/Confirmation summary|Reference/i)
  })

  it('planTurn handles has my booking been confirmed', async () => {
    resetFeatureRegistry()
    installMemoryLocalStorage()
    clearLocalBookingSessions()
    resetBookingOrchestrator()
    resetSupplierAdapterRegistry()

    const session = await seedSession('user-chat')
    await startConfirmation({ sessionId: session.id, userId: 'user-chat' })

    const service = createTravelAgentService({
      concierge: false,
      listBookingRecords: async () => [{
        sessionId: session.id,
        userId: 'user-chat',
        bookingReference: 'RHL-X',
        status: 'confirmed',
        bucket: 'upcoming',
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        confirmedAt: session.confirmedAt,
        redirectedAt: null,
        expiresAt: session.expiresAt,
        flight: null,
        passengers: [],
        fare: { fare: 0, taxes: 0, fees: 0, grandTotal: 0, currency: 'SAR', taxRate: 0.15 },
        itemTitles: ['RUH → DXB'],
        currency: 'SAR',
        total: 1200,
        providerBookingReference: 'AMA-X',
        passengersComplete: true,
        timeline: [],
      }],
    })

    const messages: ChatMessage[] = [{
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      modality: 'text',
      content: 'Has my booking been confirmed?',
      audioUrl: null,
      imageUrl: null,
      attachments: [],
      status: 'complete',
      error: null,
      providerMeta: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }]
    const turn = await service.planTurn({ conversationId: 'c1', messages })
    expect(turn.memory.lastIntent).toBe('booking_confirmed')
    expect(turn.reply).toMatch(/confirmed|pending|failed/i)

    vi.unstubAllGlobals()
  })
})

describe('Sprint 14 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  it('registers booking_confirmation / supplier_adapter / booking_timeline', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('ui.booking_confirmation')).toBe(true)
    expect(registry.isEnabled('ui.supplier_adapter')).toBe(true)
    expect(registry.isEnabled('ui.booking_timeline')).toBe(true)
    registry.setEnabled('ui.booking_confirmation', false)
    expect(registry.isEnabled('ui.supplier_adapter')).toBe(false)
    expect(registry.isEnabled('ui.booking_timeline')).toBe(false)
  })
})
