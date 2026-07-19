/**
 * Sprint 32 — AI Conversation Experience tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { resetBrainIntegrationSessions, resetUnifiedTravelPlanner } from '../brain'
import { resetAITripOrchestrator } from '../brain/orchestrator'
import { resetMemoryContextEngine } from '../brain/memory'
import { resetHotelProviderFoundation } from '../hotels'
import {
  ConversationController,
  ConversationEvents,
  ConversationRenderer,
  FollowUpQuestionEngine,
  ResponseComposer,
  StreamingResponse,
  applyCommandToState,
  createConversationChatProvider,
  createInitialConversationState,
  detectConversationCommand,
  isConversationUiEnabled,
  resetConversationController,
} from '../chat'
import type { ChatMessage } from '../chat/chatTypes'
import type { UnifiedFlightLeg, UnifiedHotelStay } from '../brain/unifiedTravel'

function enableConversationUiChain(): void {
  const registry = getFeatureRegistry()
  registry.setEnabled('ai.concierge', true)
  registry.setEnabled('brain.enabled', true)
  registry.setEnabled('brain.concierge', true)
  registry.setEnabled('brain.travel_engine', true)
  registry.setEnabled('brain.trip_planning', true)
  registry.setEnabled('brain.execution', true)
  registry.setEnabled('brain.search', true)
  registry.setEnabled('brain.trip_orchestrator', true)
  registry.setEnabled('brain.unified_travel_planner', true)
  registry.setEnabled('brain.conversation_ui', true)
}

const flight = (overrides: Partial<UnifiedFlightLeg> = {}): UnifiedFlightLeg => ({
  id: 'flt_1',
  from: 'RUH',
  to: 'CMN',
  airline: 'Saudia',
  cabin: 'economy',
  price: 1800,
  currency: 'SAR',
  stops: 0,
  durationHours: 6,
  providerId: 'mock-flight-001',
  ...overrides,
})

const hotel = (overrides: Partial<UnifiedHotelStay> = {}): UnifiedHotelStay => ({
  id: 'htl_1',
  name: 'Hilton Casablanca',
  area: 'Downtown',
  stars: 5,
  nightly: 500,
  nights: 10,
  stayTotal: 5000,
  currency: 'SAR',
  providerId: 'hotelbeds',
  amenities: ['WiFi', 'Pool'],
  freeCancellation: true,
  guestScore: 8.8,
  ...overrides,
})

function createTestController() {
  return ConversationController({
    enabled: true,
    skipPlannerOrchestrator: true,
    plannerOptions: {
      enabled: true,
      skipOrchestrator: true,
      searchFlights: async () => [
        flight(),
        flight({ id: 'flt_2', airline: 'Emirates', stops: 1, price: 1600 }),
      ],
      searchHotels: async () => [
        hotel(),
        hotel({ id: 'htl_2', name: 'City Central Inn', stars: 3, stayTotal: 2800, nightly: 280 }),
      ],
    },
  })
}

describe('Sprint 32 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetConversationController()
    resetUnifiedTravelPlanner()
    resetBrainIntegrationSessions()
    resetAITripOrchestrator()
    resetMemoryContextEngine()
    resetHotelProviderFoundation()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetConversationController()
  })

  it('registers brain.conversation_ui disabled by default', () => {
    expect(getFeatureRegistry().isEnabled('brain.conversation_ui')).toBe(false)
    expect(isConversationUiEnabled()).toBe(false)
  })

  it('requires brain.unified_travel_planner before brain.conversation_ui', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.conversation_ui', true)
    expect(registry.isEnabled('brain.conversation_ui')).toBe(false)
    enableConversationUiChain()
    expect(registry.isEnabled('brain.conversation_ui')).toBe(true)
    expect(isConversationUiEnabled()).toBe(true)
  })
})

describe('Command detection & edits', () => {
  it('detects conversational edit commands', () => {
    expect(detectConversationCommand('Make it cheaper')).toBe('make_cheaper')
    expect(detectConversationCommand('Only direct flights')).toBe('direct_flights')
    expect(detectConversationCommand('Upgrade hotel')).toBe('upgrade_hotel')
    expect(detectConversationCommand('Business class')).toBe('business_class')
    expect(detectConversationCommand('Travel with children')).toBe('travel_with_children')
    expect(detectConversationCommand('Stay near downtown')).toBe('stay_downtown')
    expect(detectConversationCommand('Shorten the trip')).toBe('shorten_trip')
    expect(detectConversationCommand('Increase budget')).toBe('increase_budget')
    expect(detectConversationCommand('Compare options')).toBe('compare_options')
    expect(detectConversationCommand('Two adults')).toBe('clarify_answer')
  })

  it('applies edits to existing state without clearing destination', () => {
    let state = createInitialConversationState('en')
    state = {
      ...state,
      context: {
        ...state.context,
        destination: 'Morocco',
        origin: 'Riyadh',
        budgetAmount: 15_000,
        nights: 10,
        adults: 2,
      },
      travelersConfirmed: true,
    }
    state = applyCommandToState(state, 'make_cheaper')
    expect(state.context.destination).toBe('Morocco')
    expect(state.context.budgetAmount).toBeLessThan(15_000)
    expect(state.editCount).toBe(1)
    expect(state.phase).toBe('editing')

    state = applyCommandToState(state, 'business_class')
    expect(state.context.cabinClass).toBe('business')
    expect(state.context.destination).toBe('Morocco')
  })
})

describe('Follow-up logic', () => {
  it('asks how many travelers after destination-only request', () => {
    const engine = new FollowUpQuestionEngine()
    let state = createInitialConversationState('en')
    state = {
      ...state,
      context: { ...state.context, destination: 'Japan' },
      travelersConfirmed: false,
    }
    expect(engine.shouldAskBeforePlanning(state)).toBe(true)
    expect(engine.nextQuestion(state)?.field).toBe('travelers')
  })

  it('does not ask passport or nationality', () => {
    const engine = new FollowUpQuestionEngine()
    const state = createInitialConversationState('en')
    const q = engine.nextQuestion({
      ...state,
      context: { ...state.context, destination: 'Japan' },
    })
    expect(q?.field).not.toBe('passportNationality')
    expect(q?.question.toLowerCase()).not.toContain('passport')
  })
})

describe('Conversation flow & planner integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetConversationController()
    resetUnifiedTravelPlanner()
    resetHotelProviderFoundation()
    enableConversationUiChain()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetConversationController()
  })

  it('Japan flow: follow-up then incremental plan update', async () => {
    const controller = createTestController()

    const first = await controller.handleTurn({
      conversationId: 'c-japan',
      userText: 'Take me to Japan next month.',
      locale: 'en',
    })
    expect(first.session.state.phase).toBe('clarifying')
    expect(first.structured.followUps[0]?.field).toBe('travelers')
    expect(first.renderedText.toLowerCase()).toContain('travelers')

    const second = await controller.handleTurn({
      conversationId: 'c-japan',
      userText: 'Two adults.',
      locale: 'en',
    })
    expect(second.session.state.travelersConfirmed).toBe(true)
    expect(second.session.state.context.adults).toBe(2)
    expect(second.session.state.context.destination).toBe('Japan')
    expect(second.planResult?.stage).toBe('complete')
    expect(second.structured.flights.length).toBeGreaterThan(0)
    expect(second.structured.hotels.length).toBeGreaterThan(0)
    expect(second.structured.dailyItinerary.length).toBeGreaterThan(0)
    expect(second.structured.estimatedTotalCost?.total).toBeGreaterThan(0)
    expect(second.structured.confidenceScore).toBeGreaterThan(0)
    expect(second.structured.suggestedFollowUpActions.length).toBeGreaterThan(0)
    // Same session — did not start over.
    expect(second.session.messages.length).toBe(4)
  })

  it('Morocco budget request produces structured response sections', async () => {
    const controller = createTestController()
    const result = await controller.handleTurn({
      conversationId: 'c-morocco',
      userText:
        'I want to travel to Morocco next August for 10 days with a budget of SAR 15,000 for 2 adults.',
      locale: 'en',
    })
    expect(result.session.state.phase).toBe('presenting')
    expect(result.renderedText).toContain('## Summary')
    expect(result.renderedText).toContain('## Flights')
    expect(result.renderedText).toContain('## Hotels')
    expect(result.renderedText).toContain('## Daily itinerary')
    expect(result.renderedText).toContain('## Estimated total cost')
    expect(result.renderedText).toContain('## Confidence score')
    expect(result.renderedText).toContain('## Reasoning')
    expect(result.session.state.context.budgetAmount).toBe(15_000)
    expect(result.session.state.context.nights).toBe(10)
  })

  it('edits previous request without restarting destination', async () => {
    const controller = createTestController()
    await controller.handleTurn({
      conversationId: 'c-edit',
      userText: 'Plan a trip from Riyadh to Dubai for 2 adults, 5 nights, budget 9000 SAR',
      locale: 'en',
    })
    const edited = await controller.handleTurn({
      conversationId: 'c-edit',
      userText: 'Make it cheaper',
      locale: 'en',
    })
    expect(edited.commandKind).toBe('make_cheaper')
    expect(edited.session.state.context.destination).toBe('Dubai')
    expect(edited.session.state.editCount).toBeGreaterThanOrEqual(1)
    expect(edited.planResult?.plans.length).toBeGreaterThan(0)
  })

  it('compare options reuses last plan without clearing memory', async () => {
    const controller = createTestController()
    await controller.handleTurn({
      conversationId: 'c-compare',
      userText: 'from Riyadh to Jeddah for 2 adults, 3 nights, budget 7000 SAR',
      locale: 'en',
    })
    const compared = await controller.handleTurn({
      conversationId: 'c-compare',
      userText: 'Compare options',
      locale: 'en',
    })
    expect(compared.commandKind).toBe('compare_options')
    expect(compared.session.state.phase).toBe('comparing')
    expect(compared.structured.plans.length).toBeGreaterThan(1)
    expect(compared.session.state.context.destination).toBe('Jeddah')
  })

  it('streams deltas then done with structured meta', async () => {
    const controller = createTestController()
    const chunks: Array<{ type: string; text?: string; meta?: Record<string, unknown> }> = []
    for await (const chunk of controller.streamTurn({
      conversationId: 'c-stream',
      userText: 'from Riyadh to Dubai for 2 adults, 4 nights, budget 8000 SAR',
      locale: 'en',
    })) {
      chunks.push(chunk)
    }
    expect(chunks.some((c) => c.type === 'delta')).toBe(true)
    const done = chunks.find((c) => c.type === 'done')
    expect(done?.meta?.conversationUi).toBe(true)
    expect(done?.meta?.structured).toBeTruthy()
  })

  it('emits conversation events across a turn', async () => {
    const events = new ConversationEvents()
    const seen: string[] = []
    events.on('*', (e) => seen.push(e.type))
    const controller = ConversationController({
      enabled: true,
      events,
      skipPlannerOrchestrator: true,
      plannerOptions: {
        enabled: true,
        skipOrchestrator: true,
        searchFlights: async () => [flight()],
        searchHotels: async () => [hotel()],
      },
    })
    await controller.handleTurn({
      conversationId: 'c-events',
      userText: 'from Riyadh to Doha for 2 adults, 3 nights',
      locale: 'en',
    })
    expect(seen).toEqual(expect.arrayContaining([
      'session_started',
      'turn_started',
      'command_detected',
      'planning_started',
      'planning_completed',
      'response_composed',
      'turn_completed',
    ]))
  })

  it('falls back when conversation UI disabled', async () => {
    const controller = ConversationController({ enabled: false })
    const result = await controller.handleTurn({
      conversationId: 'c-off',
      userText: 'Trip to Dubai',
      locale: 'en',
    })
    expect(result.structured.phase).toBe('error')
    expect(result.renderedText.toLowerCase()).toContain('disabled')
  })
})

describe('Response composer & renderer', () => {
  it('composes structured sections from a plan result', () => {
    const composer = new ResponseComposer()
    const renderer = new ConversationRenderer()
    const structured = composer.compose({
      planResult: {
        conversationId: 'c1',
        stage: 'complete',
        intent: 'SearchPackages',
        headline: 'Top plan: Saudia · Dubai',
        plans: [],
        topPlan: {
          id: 'p1',
          rank: 1,
          title: 'Saudia · Dubai · Hilton',
          summary: 'Nice trip',
          confidence: 0.82,
          score: 0.8,
          factors: {
            budget: 0.9,
            duration: 0.8,
            preferences: 0.7,
            loyalty: 0.5,
            conversation_context: 0.8,
            flight_hotel_match: 0.85,
          },
          reasons: ['Fits budget'],
          flight: flight({ to: 'DXB' }),
          hotel: hotel({ name: 'Hilton Dubai' }),
          cost: {
            currency: 'SAR',
            flights: 2400,
            hotels: 1500,
            activities: 300,
            transport: 120,
            taxesAndFees: 300,
            total: 4620,
            nights: 3,
            withinBudget: true,
            budgetAmount: 9000,
            remainingBudget: 4380,
          },
          itinerary: [
            {
              day: 1,
              date: '2026-08-01',
              title: 'Arrival',
              summary: 'Arrive Dubai',
              items: ['Fly', 'Check-in'],
            },
          ],
          matchedPreferences: ['Hilton'],
          loyaltyAligned: false,
        },
        alternatives: [],
        followUps: [],
        missingFields: [],
        recommendation: null,
        confidenceScore: 0.82,
        reasoning: ['Ranked 1 option'],
        costSummary: null,
        providers: {
          flightsUsed: 1,
          hotelsUsed: 1,
          hotelProviderId: 'hotelbeds',
          flightProviderIds: ['mock-flight-001'],
          fromHotelFoundation: true,
          fromOrchestrator: false,
        },
        durationMs: 10,
        error: null,
        orchestrator: null,
        memory: null,
      },
      phase: 'presenting',
      locale: 'en',
    })
    expect(structured.flights[0].airline).toBe('Saudia')
    expect(structured.hotels[0].name).toContain('Hilton')
    expect(structured.confidenceScore).toBe(0.82)
    const text = renderer.render(structured, 'en')
    expect(text).toContain('## Summary')
    expect(text).toContain('Within budget')
  })
})

describe('StreamingResponse unit', () => {
  it('yields deltas and done', async () => {
    const stream = new StreamingResponse({ delayMs: 0, chunkSize: 5 })
    const structured = new ResponseComposer().compose({
      planResult: null,
      phase: 'clarifying',
      locale: 'en',
      clarificationQuestion: 'How many travelers?',
    })
    const chunks = []
    for await (const chunk of stream.stream('Hello world', structured)) {
      chunks.push(chunk)
    }
    expect(chunks.filter((c) => c.type === 'delta').length).toBeGreaterThan(1)
    expect(chunks.at(-1)?.type).toBe('done')
  })
})

describe('Conversation chat provider regression', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetConversationController()
    enableConversationUiChain()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetConversationController()
  })

  it('uses conversation UI when enabled and falls back when forced off', async () => {
    const controller = createTestController()
    const provider = createConversationChatProvider({
      conversationUiEnabled: true,
      controller,
    })
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        conversationId: 'c-prov',
        role: 'user',
        modality: 'text',
        content: 'from Riyadh to Bahrain for 2 adults, 3 nights, budget 5000 SAR',
        audioUrl: null,
        imageUrl: null,
        attachments: [],
        status: 'complete',
        error: null,
        providerMeta: {},
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
      },
    ]
    const chunks = []
    for await (const chunk of provider.streamReply({
      conversationId: 'c-prov',
      messages,
      signal: new AbortController().signal,
    })) {
      chunks.push(chunk)
    }
    expect(chunks.at(-1)?.meta?.conversationUi).toBe(true)

    const offProvider = createConversationChatProvider({
      conversationUiEnabled: false,
      fallback: {
        providerId: 'fallback-mock',
        async *streamReply() {
          yield { type: 'delta', text: 'fallback' }
          yield { type: 'done', meta: { fallback: true } }
        },
      },
    })
    const offChunks = []
    for await (const chunk of offProvider.streamReply({
      conversationId: 'c-prov',
      messages,
      signal: new AbortController().signal,
    })) {
      offChunks.push(chunk)
    }
    expect(offChunks.some((c) => c.text === 'fallback')).toBe(true)
  })
})
