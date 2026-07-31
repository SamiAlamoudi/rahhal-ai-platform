/**
 * Sprint 17 — Smart Itinerary AI Engine.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLocalBookingSessions,
  getBookingOrchestrator,
  persistBookingSession,
  resetBookingOrchestrator,
  toBookingRecord,
} from '../booking'
import { extractFromUserText } from '../agent/extractRequirements'
import { createTravelAgentService } from '../agent/travelAgentService'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import type { ChatMessage } from '../chat/chatTypes'
import {
  buildDailyPlans,
  buildItineraryTimeline,
  buildTravelInsights,
  buildSmartItineraryConciergeReply,
  clearItineraryCache,
  flightDurationMinutes,
  generateTripItinerary,
  getOrGenerateItinerary,
  recommendLeaveForAirport,
} from '../smartItinerary'

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

async function seedSession(userId = 'user-s17') {
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
    providerOfferId: 'offer-s17',
    title: 'RUH → IST',
    price: 1800,
    currency: 'SAR',
    bookingUrl: 'https://example.com/book',
    expiresAt: null,
    travelerSummary: 'adults:2|children:0|infants:0|total:2',
    metadata: {
      sprint: 17,
      selectedItinerary: {
        origin: 'RUH',
        destination: 'IST',
        departureTime: '2026-09-10T08:00:00.000Z',
        arrivalTime: '2026-09-10T13:00:00.000Z',
        airline: 'Saudia',
        cabin: 'economy',
        stops: 0,
      },
      pricing: { fare: 1800, taxes: 270, fees: 0, grandTotal: 2070, currency: 'SAR' },
      passengers: [
        {
          id: 'p1',
          type: 'adult',
          firstName: 'Noura',
          lastName: 'Ali',
          title: 'ms',
          gender: 'female',
          dateOfBirth: '1991-01-01',
          nationality: 'SA',
          passportNumber: 'P777',
          passportExpiry: '2030-01-01',
          passportIssuingCountry: 'SA',
          email: 'noura@example.com',
          mobileNumber: '+966500000001',
          emergencyContact: '',
          specialAssistance: '',
          mealPreference: '',
          frequentFlyerNumber: '',
        },
        {
          id: 'p2',
          type: 'adult',
          firstName: 'Omar',
          lastName: 'Ali',
          title: 'mr',
          gender: 'male',
          dateOfBirth: '1989-01-01',
          nationality: 'SA',
          passportNumber: 'P778',
          passportExpiry: '2030-01-01',
          passportIssuingCountry: 'SA',
          email: 'omar@example.com',
          mobileNumber: '+966500000002',
          emergencyContact: '',
          specialAssistance: '',
          mealPreference: '',
          frequentFlyerNumber: '',
        },
      ],
      passengersComplete: true,
      bookingPayload: { kind: 'flight_selection', offerId: 'offer-s17' },
    },
  })
  const live = orch.getBookingSession(session.id)!
  await persistBookingSession(live)
  return live
}

describe('Sprint 17 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  it('registers smart_itinerary / travel_insights / daily_planner', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('ui.smart_itinerary')).toBe(true)
    expect(registry.isEnabled('ui.travel_insights')).toBe(true)
    expect(registry.isEnabled('ui.daily_planner')).toBe(true)
    registry.setEnabled('ui.smart_itinerary', false)
    expect(registry.isEnabled('ui.travel_insights')).toBe(false)
    expect(registry.isEnabled('ui.daily_planner')).toBe(false)
  })
})

describe('Sprint 17 itinerary engine', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
    clearLocalBookingSessions()
    resetBookingOrchestrator()
    clearItineraryCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('generates TripItinerary from booking with timeline, days, insights', async () => {
    const session = await seedSession()
    const record = toBookingRecord(session)
    const itin = generateTripItinerary(record)

    expect(itin.bookingSessionId).toBe(session.id)
    expect(itin.summary.origin).toBe('RUH')
    expect(itin.summary.destination).toBe('IST')
    expect(itin.summary.passengerCount).toBe(2)
    expect(itin.timeline.length).toBeGreaterThanOrEqual(6)
    expect(itin.timeline.some((e) => e.type === 'flight_depart')).toBe(true)
    expect(itin.timeline.some((e) => e.type === 'hotel_checkin' && e.placeholder)).toBe(true)
    expect(itin.days.length).toBeGreaterThanOrEqual(2)
    expect(itin.days[0].parts.some((p) => p.part === 'morning')).toBe(true)
    expect(itin.insights.some((i) => i.kind === 'airport_arrival')).toBe(true)
    expect(itin.generationMode).toBe('rule_based')

    const cached = getOrGenerateItinerary(record)
    expect(cached.id).toBe(itin.id)
  })

  it('builds timeline and daily planner modules independently', async () => {
    const session = await seedSession('u-tl')
    const record = toBookingRecord(session)
    const timeline = buildItineraryTimeline(record)
    expect(timeline.map((t) => t.type)).toEqual(expect.arrayContaining([
      'departure_prep',
      'airport_arrival',
      'flight_depart',
      'flight_arrive',
      'daily_schedule',
      'return_flight',
    ]))

    const days = buildDailyPlans(record, { dayCount: 3 })
    expect(days).toHaveLength(3)
    expect(days[0].parts).toHaveLength(4)
  })

  it('computes travel insights and leave-for-airport recommendation', async () => {
    const session = await seedSession('u-ins')
    const record = toBookingRecord(session)
    const insights = buildTravelInsights(record)
    expect(insights.length).toBeGreaterThanOrEqual(5)
    expect(insights.every((i) => i.architectureReady)).toBe(true)

    const duration = flightDurationMinutes(
      record.flight!.departureTime,
      record.flight!.arrivalTime,
    )
    expect(duration).toBe(300)

    const leave = recommendLeaveForAirport(record.flight!.departureTime, 0)
    expect(leave).not.toBeNull()
    expect(leave!.getTime()).toBeLessThan(Date.parse(record.flight!.departureTime))
  })
})

describe('Sprint 17 AI Concierge itinerary intents', () => {
  it('detects itinerary questions', () => {
    expect(extractFromUserText('Show my itinerary', 'en').intent).toBe('show_my_itinerary')
    expect(extractFromUserText("What's today's plan?", 'en').intent).toBe('whats_todays_plan')
    expect(extractFromUserText('When should I leave for the airport?', 'en').intent).toBe('when_leave_for_airport')
    expect(extractFromUserText('Summarize my trip', 'en').intent).toBe('summarize_my_trip')
  })

  it('answers via concierge helpers', async () => {
    installMemoryLocalStorage()
    clearLocalBookingSessions()
    resetBookingOrchestrator()
    clearItineraryCache()

    const session = await seedSession('u-ai')
    const record = toBookingRecord(session)

    expect(buildSmartItineraryConciergeReply({
      intent: 'show_my_itinerary',
      record,
      locale: 'en',
    })).toMatch(/itinerary/i)

    expect(buildSmartItineraryConciergeReply({
      intent: 'when_leave_for_airport',
      record,
      locale: 'en',
    })).toMatch(/airport/i)

    expect(buildSmartItineraryConciergeReply({
      intent: 'summarize_my_trip',
      record,
      locale: 'en',
    })).toMatch(/RUH|IST|trip/i)

    vi.unstubAllGlobals()
  })

  it('travel agent answers itinerary questions when booking exists', async () => {
    installMemoryLocalStorage()
    clearLocalBookingSessions()
    resetBookingOrchestrator()
    clearItineraryCache()
    resetFeatureRegistry()

    const session = await seedSession('u-agent')
    const service = createTravelAgentService({
      concierge: false,
      listBookingRecords: async () => [toBookingRecord(getBookingOrchestrator().getBookingSession(session.id)!)],
    })

    const messages: ChatMessage[] = [{
      id: 'm1',
      conversationId: 'c-s17',
      role: 'user',
      modality: 'text',
      content: 'Show my itinerary',
      audioUrl: null,
      imageUrl: null,
      attachments: [],
      status: 'complete',
      error: null,
      providerMeta: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }]
    const turn = await service.planTurn({ conversationId: 'c-s17', messages })
    expect(turn.memory.lastIntent).toBe('show_my_itinerary')
    expect(turn.reply.length).toBeGreaterThan(10)
    expect(turn.meta.spokenText?.length).toBeGreaterThan(0)
    const record = toBookingRecord(getBookingOrchestrator().getBookingSession(session.id)!)
    expect(record.flight?.origin).toBe('RUH')
    expect(record.flight?.destination).toBe('IST')

    vi.unstubAllGlobals()
  })
})
