import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getFeatureRegistry,
  resetFeatureRegistry,
} from '../ai'
import {
  buildTravelCards,
  buildConversationTimeline,
  buildMemoryChips,
  buildMapPreview,
  buildItineraryMapPreviews,
  createConversationBookingBridge,
  extractConversationUiMeta,
  getConversationLiveNotificationBus,
  resetConversationLiveNotificationBus,
  isConversationExperienceEnabled,
  resolveChatTheme,
  chatThemeClassName,
  enrichPlanForBooking,
} from '../chat/conversationExperienceUi'
import type { ConversationStructuredResponse } from '../chat/conversationExperience/types'
import type { UnifiedTravelPlanOption } from '../brain/unifiedTravel/types'

function enableConversationExperienceChain(): void {
  const registry = getFeatureRegistry()
  for (const id of [
    'brain.enabled',
    'brain.concierge',
    'brain.travel_engine',
    'brain.trip_planning',
    'brain.execution',
    'brain.search',
    'brain.trip_orchestrator',
    'brain.unified_travel_planner',
    'brain.conversation_ui',
    'brain.travel_execution_engine',
    'brain.payments_platform',
    'brain.trip_management',
    'ui.conversation_experience',
  ] as const) {
    registry.setEnabled(id, true)
  }
}

function samplePlan(overrides: Partial<UnifiedTravelPlanOption> = {}): UnifiedTravelPlanOption {
  return {
    id: 'plan_1',
    rank: 1,
    title: 'Tokyo escape',
    summary: 'Flight + hotel',
    confidence: 0.9,
    score: 0.88,
    factors: {
      budget: 0.8,
      duration: 0.7,
      preferences: 0.6,
      loyalty: 0.5,
      conversation_context: 0.7,
      flight_hotel_match: 0.9,
    },
    reasons: ['good match'],
    flight: {
      id: 'fl_1',
      from: 'RUH',
      to: 'NRT',
      airline: 'Saudia',
      cabin: 'Economy',
      price: 3200,
      currency: 'SAR',
      stops: 0,
      durationHours: 10,
      providerId: 'mock-flight',
    },
    hotel: {
      id: 'ht_1',
      name: 'Tokyo Bay',
      area: 'Tokyo',
      stars: 4,
      nightly: 700,
      nights: 5,
      stayTotal: 3500,
      currency: 'SAR',
      providerId: 'mock-hotel',
      amenities: ['Breakfast', 'WiFi'],
      freeCancellation: true,
      guestScore: 8.7,
    },
    cost: {
      currency: 'SAR',
      flights: 3200,
      hotels: 3500,
      activities: 200,
      transport: 180,
      taxesAndFees: 300,
      total: 7380,
      nights: 5,
      withinBudget: true,
      budgetAmount: 9000,
      remainingBudget: 1620,
    },
    itinerary: [
      { day: 1, date: null, title: 'Arrive Tokyo', summary: 'Arrival', items: ['Shibuya walk'] },
    ],
    matchedPreferences: [],
    loyaltyAligned: true,
    ...overrides,
  }
}

function sampleStructured(): ConversationStructuredResponse {
  const plan = samplePlan()
  return {
    summary: 'Here is a Tokyo plan',
    flights: [
      {
        id: plan.flight!.id,
        airline: plan.flight!.airline,
        from: plan.flight!.from,
        to: plan.flight!.to,
        cabin: plan.flight!.cabin,
        price: plan.flight!.price,
        currency: plan.flight!.currency,
        stops: plan.flight!.stops,
      },
    ],
    hotels: [
      {
        id: plan.hotel!.id,
        name: plan.hotel!.name,
        area: plan.hotel!.area,
        stars: plan.hotel!.stars,
        nightly: plan.hotel!.nightly,
        currency: plan.hotel!.currency,
      },
    ],
    dailyItinerary: plan.itinerary,
    estimatedTotalCost: plan.cost,
    confidenceScore: 0.9,
    reasoning: ['Fits budget'],
    suggestedFollowUpActions: [
      { id: 'pay', label: 'Pay Now', commandHint: 'Pay now' },
      { id: 'cheaper', label: 'Make it cheaper', commandHint: 'Make it cheaper' },
    ],
    plans: [plan],
    topPlanId: plan.id,
    followUps: [],
    phase: 'presenting',
  }
}

describe('Sprint 42 feature flag', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('registers ui.conversation_experience disabled by default', () => {
    expect(getFeatureRegistry().get('ui.conversation_experience')?.enabled).toBe(false)
    expect(isConversationExperienceEnabled()).toBe(false)
  })

  it('requires brain.conversation_ui chain before enabling experience UX', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('ui.conversation_experience', true)
    expect(isConversationExperienceEnabled()).toBe(false)
    enableConversationExperienceChain()
    expect(isConversationExperienceEnabled()).toBe(true)
  })
})

describe('structured meta + cards', () => {
  it('extracts conversation UI meta from providerMeta', () => {
    const structured = sampleStructured()
    const meta = extractConversationUiMeta({
      conversationUi: true,
      structured,
      payNow: true,
      memory: { preferredAirlines: ['Saudia'], seatPreferences: ['window'] },
    })
    expect(meta.conversationUi).toBe(true)
    expect(meta.structured?.flights).toHaveLength(1)
    expect(meta.payNow).toBe(true)
    expect(meta.memory?.preferredAirlines).toEqual(['Saudia'])
  })

  it('builds flight/hotel/car/activity/visa/insurance cards', () => {
    const cards = buildTravelCards(sampleStructured(), { locale: 'en' })
    const kinds = new Set(cards.map((c) => c.kind))
    expect(kinds.has('flight')).toBe(true)
    expect(kinds.has('hotel')).toBe(true)
    expect(kinds.has('car')).toBe(true)
    expect(kinds.has('activity')).toBe(true)
    expect(kinds.has('visa')).toBe(true)
    expect(kinds.has('insurance')).toBe(true)
    const flight = cards.find((c) => c.kind === 'flight')
    expect(flight && flight.kind === 'flight' && flight.airline).toBe('Saudia')
  })

  it('builds memory chips and map previews', () => {
    const chips = buildMemoryChips({
      preferredAirlines: ['Saudia'],
      seatPreferences: ['window'],
      budgetRange: { max: 9000, currency: 'SAR' },
      loyaltyPrograms: [{ program: 'Alfursan', memberNumber: null }],
      passportNationality: { nationality: 'SA', passportCountry: 'SA', explicitlyProvided: true },
      visaStatus: 'needs_visa',
    }, 'en')
    expect(chips.some((c) => c.id === 'airlines')).toBe(true)
    expect(chips.some((c) => c.id === 'budget')).toBe(true)

    const map = buildMapPreview({ kind: 'hotel', query: 'Tokyo Bay Hotel' })
    expect(map.embedUrl).toContain('openstreetmap')
    expect(buildItineraryMapPreviews(['RUH', 'NRT', 'Tokyo']).length).toBe(3)
  })
})

describe('booking actions + timeline + notifications', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    enableConversationExperienceChain()
    resetConversationLiveNotificationBus()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetConversationLiveNotificationBus()
  })

  it('reserves, pays, views documents, and builds timeline without leaving conversation APIs', async () => {
    const bridge = createConversationBookingBridge({
      executionEnabled: true,
      paymentsEnabled: true,
      tripsEnabled: true,
    })
    const plan = enrichPlanForBooking(sampleStructured())
    expect(plan).not.toBeNull()

    const reserved = await bridge.reserve({
      conversationId: 'conv_s42',
      userId: 'user_s42',
      selectedItinerary: plan!,
      locale: 'en',
      travelers: { adults: 2 },
    })
    expect(reserved.execution?.summary.success).toBe(true)

    const paid = await bridge.pay(reserved, 'card')
    expect(paid.paymentResult?.success).toBe(true)
    expect(paid.trip?.tripId).toBeTruthy()

    const docs = bridge.viewDocuments(paid)
    expect(docs.documents.length).toBeGreaterThan(0)

    const timeline = buildConversationTimeline({
      trips: paid.trip ? [paid.trip] : [],
      executionTimeline: paid.execution?.session.timeline ?? [],
      bookingReference: paid.execution?.summary.references.bookingReference ?? null,
      paid: true,
    })
    expect(timeline.length).toBeGreaterThan(0)
    expect(timeline.some((e) => e.bookingReference)).toBe(true)

    const refunded = await bridge.refund(paid)
    expect(refunded.message.toLowerCase()).toMatch(/refund/)
  })

  it('publishes live notifications without refresh', () => {
    const bus = getConversationLiveNotificationBus()
    const seen: number[] = []
    const unsub = bus.subscribe((events) => seen.push(events.length))
    bus.publishFromTrigger({
      trigger: 'flight_delay',
      title: 'Flight delayed',
      body: 'NRT departure delayed 40m',
      tripId: 'trip_1',
    })
    bus.publish({
      kind: 'visa_approved',
      title: 'Visa approved',
      body: 'Documents ready',
    })
    expect(bus.list().length).toBe(2)
    expect(bus.list()[0].kind).toBe('visa_approved')
    expect(seen.at(-1)).toBe(2)
    unsub()
  })
})

describe('accessibility helpers', () => {
  it('resolves chat themes including high contrast', () => {
    expect(resolveChatTheme('light')).toBe('light')
    expect(resolveChatTheme('dark')).toBe('dark')
    expect(resolveChatTheme('high_contrast')).toBe('high_contrast')
    expect(chatThemeClassName('dark')).toBe('chat-theme-dark')
    expect(chatThemeClassName('high_contrast')).toBe('chat-theme-contrast')
  })
})

describe('mobile responsiveness contracts', () => {
  it('keeps card model fields required by mobile-first cards', () => {
    const cards = buildTravelCards(sampleStructured(), { locale: 'ar' })
    for (const card of cards) {
      expect(card.id).toBeTruthy()
      expect(card.kind).toBeTruthy()
    }
  })
})
