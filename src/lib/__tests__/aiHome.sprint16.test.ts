/**
 * Sprint 16 — AI Home Experience (conversation-first).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAiHomeGreeting,
  buildAiHomeModel,
  buildContinueBookingModel,
  buildTravelCards,
  conversationEntryPath,
  findContinueBookingCandidate,
  listSuggestedPrompts,
  promptText,
  resolveDayPart,
  upcomingTripCards,
} from '../aiHome'
import {
  clearLocalBookingSessions,
  getBookingOrchestrator,
  persistBookingSession,
  resetBookingOrchestrator,
  toBookingRecord,
  canResumeBookingSession,
} from '../booking'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { clearAllOrders } from '../payment/orderManager'
import { clearBookingOrderIndex } from '../orderManagement'
import { resetSupplierAdapterRegistry } from '../supplierAdapters'

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

async function seedDraftSession(userId = 'user-s16') {
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
    providerOfferId: 'offer-s16',
    title: 'RUH → JED',
    price: 400,
    currency: 'SAR',
    bookingUrl: 'https://example.com/book',
    expiresAt: null,
    travelerSummary: 'adults:1|children:0|infants:0|total:1',
    metadata: {
      sprint: 16,
      selectedItinerary: {
        origin: 'RUH',
        destination: 'JED',
        departureTime: '2026-08-01T08:00:00',
        arrivalTime: '2026-08-01T10:00:00',
        airline: 'Saudia',
        cabin: 'economy',
        stops: 0,
      },
      passengers: [],
      passengersComplete: false,
    },
  })
  const live = orch.getBookingSession(session.id)!
  await persistBookingSession(live)
  return live
}

describe('Sprint 16 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  it('registers ai_home / conversation_home / travel_cards / continue_booking', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('ui.ai_home')).toBe(true)
    expect(registry.isEnabled('ui.conversation_home')).toBe(true)
    expect(registry.isEnabled('ui.travel_cards')).toBe(true)
    expect(registry.isEnabled('ui.continue_booking')).toBe(true)
    registry.setEnabled('ui.ai_home', false)
    expect(registry.isEnabled('ui.conversation_home')).toBe(false)
    expect(registry.isEnabled('ui.travel_cards')).toBe(false)
  })
})

describe('Sprint 16 greeting & conversation entry', () => {
  it('builds time-aware greetings', () => {
    expect(resolveDayPart(new Date('2026-07-19T08:00:00'))).toBe('morning')
    expect(resolveDayPart(new Date('2026-07-19T19:00:00'))).toBe('evening')
    const g = buildAiHomeGreeting({
      displayName: 'Sami',
      returning: true,
      now: new Date('2026-07-19T19:00:00'),
    })
    expect(g.timeGreetingEn).toMatch(/evening/i)
    expect(g.welcomeEn).toMatch(/Welcome back/)
    expect(g.questionAr).toMatch(/تود السفر/)
  })

  it('lists suggested prompts that open conversation text', () => {
    const prompts = listSuggestedPrompts({ includeContinue: true, limit: 6 })
    expect(prompts.length).toBe(6)
    expect(prompts.some((p) => p.id === 'weekend')).toBe(true)
    const weekend = prompts.find((p) => p.id === 'weekend')!
    expect(promptText(weekend, 'en')).toMatch(/weekend/i)
  })

  it('builds conversation entry path for Chat seed', () => {
    const entry = conversationEntryPath('I want to travel to Tokyo.')
    expect(entry.pathname).toBe('/chat')
    expect(entry.state.seedMessage).toMatch(/Tokyo/)
  })
})

describe('Sprint 16 continue booking', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
    clearLocalBookingSessions()
    resetBookingOrchestrator()
    resetSupplierAdapterRegistry()
    clearAllOrders()
    clearBookingOrderIndex()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('finds unfinished booking and builds resume model with remaining steps', async () => {
    const session = await seedDraftSession()
    expect(canResumeBookingSession(session.status)).toBe(true)
    const record = toBookingRecord(session)
    const candidate = findContinueBookingCandidate([record])
    expect(candidate?.sessionId).toBe(session.id)

    const model = buildContinueBookingModel(record, session)
    expect(model).not.toBeNull()
    expect(model!.resumePath).toContain('/booking/passengers')
    expect(model!.remainingSteps.some((s) => s.current)).toBe(true)
  })
})

describe('Sprint 16 travel cards & home model', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
    clearLocalBookingSessions()
    resetBookingOrchestrator()
    resetSupplierAdapterRegistry()
    clearAllOrders()
    clearBookingOrderIndex()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds upcoming and recommendation cards', async () => {
    const session = await seedDraftSession('u-cards')
    const record = toBookingRecord(session)
    const cards = buildTravelCards({
      upcoming: record.bucket === 'upcoming' ? [record] : [],
      orders: [],
      includePlaceholders: true,
    })
    expect(cards.some((c) => c.kind === 'recommended_destination')).toBe(true)
    expect(cards.some((c) => c.kind === 'travel_inspiration')).toBe(true)
    expect(cards.some((c) => c.kind === 'saved_search')).toBe(true)
    if (record.bucket === 'upcoming') {
      expect(upcomingTripCards([record]).length).toBe(1)
    }
  })

  it('assembles full AI home model', async () => {
    const session = await seedDraftSession('u-home')
    const record = toBookingRecord(session)

    const model = buildAiHomeModel({
      locale: 'ar',
      displayName: 'Sami',
      records: [record],
      orders: [],
    })
    expect(model.greeting.questionAr).toBeTruthy()
    expect(model.suggestions.length).toBeGreaterThan(0)
    expect(model.travelCards.length).toBeGreaterThan(0)
    expect(model.continueBooking).not.toBeNull()
  })
})
