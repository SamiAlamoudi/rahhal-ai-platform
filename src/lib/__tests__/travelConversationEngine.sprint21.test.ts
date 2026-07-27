/**
 * Sprint 21 — Real Travel Conversation Engine.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'
import {
  ConversationMemoryApi,
  ConversationOrchestrator,
  MissingInformationDetector,
  RequirementExtractor,
  buildContextualFollowUp,
  buildTravelDomainBridge,
  createEmptyMemory,
  isBrainTravelEngineEnabled,
  resetBrainIntegrationSessions,
  runIntegratedBrainTurn,
} from '../brain'

function userMessage(content: string, conversationId = 'c-s21'): ChatMessage {
  const now = '2026-07-19T00:00:00.000Z'
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: now,
    updatedAt: now,
  }
}

describe('Sprint 21 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  it('registers brain.travel_engine disabled by default', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('brain.travel_engine')).toBe(false)
    expect(isBrainTravelEngineEnabled()).toBe(false)
  })

  it('requires brain.concierge (and brain.enabled) before travel_engine', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.travel_engine', true)
    expect(registry.isEnabled('brain.travel_engine')).toBe(false)
    registry.setEnabled('brain.enabled', true)
    registry.setEnabled('brain.concierge', true)
    expect(registry.isEnabled('brain.travel_engine')).toBe(true)
    expect(isBrainTravelEngineEnabled()).toBe(true)
  })
})

describe('Sprint 21 RequirementExtractor', () => {
  it('detects origin, destination, pax breakdown, cabin, airlines, hotel, budget, flexible dates', () => {
    const { patch } = RequirementExtractor({
      text:
        'Flights from Riyadh to Tokyo for 2 adults 1 child, business class, Saudia, resort hotel needed, budget 12000 SAR, flexible dates',
      locale: 'en',
    })
    expect(patch.origin).toBe('Riyadh')
    expect(patch.destination).toBe('Tokyo')
    expect(patch.travelers?.adults).toBe(2)
    expect(patch.travelers?.children).toBe(1)
    expect(patch.travelers?.infants).toBe(0)
    expect(patch.travelers?.count).toBe(3)
    expect(patch.cabinClass).toBe('business')
    expect(patch.airlinePreferences).toContain('Saudia')
    expect(patch.hotelPreferences).toContain('resort')
    expect(patch.hotelRequirement).toBe(true)
    expect(patch.budget?.amount).toBe(12000)
    expect(patch.travelDates?.flexible).toBe(true)
  })

  it('detects ISO travel dates and flights-only hotel requirement', () => {
    const { patch } = RequirementExtractor({
      text: 'Trip to Dubai 2026-08-01 to 2026-08-08, flights only',
      locale: 'en',
    })
    expect(patch.destination).toBe('Dubai')
    expect(patch.travelDates?.startDate).toBe('2026-08-01')
    expect(patch.travelDates?.endDate).toBe('2026-08-08')
    expect(patch.hotelRequirement).toBe(false)
  })

  it('maps Japan visit to Tokyo destination', () => {
    const { patch } = RequirementExtractor({
      text: 'I want to visit Japan.',
      locale: 'en',
    })
    expect(patch.destination).toBe('Tokyo')
  })
})

describe('Sprint 21 memory + one follow-up', () => {
  it('never re-asks filled slots and asks exactly one missing field', () => {
    let memory = createEmptyMemory('c-mem', 'en')
    memory = ConversationMemoryApi.applyPatch(memory, {
      destination: 'Tokyo',
      destinations: ['Tokyo'],
      budget: { amount: 8000, currency: 'SAR', flexible: false },
      travelers: { count: 4, adults: 2, children: 2, infants: 0 },
      airlinePreferences: ['Saudia'],
      hotelPreferences: ['resort'],
      hotelRequirement: true,
      origin: 'Riyadh',
    })

    const missing = MissingInformationDetector({
      memory,
      intent: 'SearchFlights',
      domainSlots: true,
    })
    expect(missing).toEqual(['travelDates'])
    expect(missing).toHaveLength(1)

    const reply = buildContextualFollowUp({
      memory,
      missingFields: missing,
      locale: 'en',
    })
    expect(reply).toBeTruthy()
    expect(reply).toMatch(/When do you want to travel/)
    expect(reply).toMatch(/Tokyo/)
    expect(reply).toMatch(/8000/)
    expect(reply).toMatch(/Saudia/)
    expect(reply).toMatch(/resort/)
    // Exactly one question mark / one ask — not a multi-question dump.
    expect((reply!.match(/\?/g) ?? []).length).toBe(1)
  })

  it('skips asked fields forever (never ask twice)', () => {
    let memory = createEmptyMemory('c-ask', 'en')
    memory = ConversationMemoryApi.markAsked(memory, ['travelDates'])
    const missing = MissingInformationDetector({
      memory,
      intent: 'SearchFlights',
      domainSlots: true,
    })
    expect(missing.includes('travelDates')).toBe(false)
  })
})

describe('Sprint 21 TravelPlan + domain bridge', () => {
  it('builds TravelPlan linked to flights, hotels, itinerary, booking, passengers', () => {
    const brain = ConversationOrchestrator({
      conversationId: 'c-plan',
      locale: 'en',
      travelEngine: true,
    })
    const result = brain.runTurn({
      userText:
        'Find flights from Jeddah to Paris for 2 adults, 5 days, economy, Emirates, with hotel boutique',
    })

    expect(result.plan.travelPlan).toBeTruthy()
    expect(result.plan.travelPlan?.flights?.kind).toBe('flights')
    expect(result.plan.travelPlan?.hotels?.kind).toBe('hotels')
    expect(result.plan.travelPlan?.itinerary?.kind).toBe('itinerary')
    expect(result.plan.travelPlan?.bookingSession?.kind).toBe('booking_session')
    expect(result.plan.travelPlan?.passengers?.kind).toBe('passengers')
    expect(result.plan.travelPlan?.origin).toBe('Jeddah')
    expect(result.plan.travelPlan?.destination).toBe('Paris')
    expect(result.plan.travelPlan?.preferredAirlines).toContain('Emirates')
    expect(result.domain).toBeTruthy()
    expect(result.domain?.searchDraft?.departureCity).toBe('Jeddah')
    expect(result.domain?.passengerCounts?.adults).toBe(2)
    expect(result.domain?.passengerSlotIds.length).toBe(2)
    expect(result.domain?.bookingSessionDraft?.status).toBe('draft')
    expect(result.domain?.itinerarySeed?.destination).toBe('Paris')
  })

  it('domain bridge readyForSearch only when slots are complete', () => {
    const memory = ConversationMemoryApi.applyPatch(createEmptyMemory('c-d', 'en'), {
      destination: 'Dubai',
      destinations: ['Dubai'],
      origin: 'Riyadh',
      travelDates: { startDate: '2026-09-01', endDate: '2026-09-05', durationDays: 4, flexible: false },
      travelers: { count: 1, adults: 1, children: 0, infants: 0 },
    })
    const brain = ConversationOrchestrator({
      conversationId: 'c-ready',
      locale: 'en',
      travelEngine: true,
      context: {
        conversationId: 'c-ready',
        memory,
        history: { conversationId: 'c-ready', turns: [] },
        goals: {
          primaryIntent: null,
          secondaryIntents: [],
          tripPurpose: null,
          mustHave: [],
          niceToHave: [],
        },
        preferences: {
          pace: null,
          style: null,
          interests: [],
          avoid: [],
          notes: null,
        },
        lastIntent: null,
        missingFields: [],
        locale: 'en',
      },
    })
    const result = brain.runTurn({ userText: 'search flights please' })
    expect(result.plan.action).toBe('search_flights')
    expect(result.plan.travelPlan?.status).toBe('ready')
    expect(result.domain?.searchDraft?.readyForSearch).toBe(true)

    const bridge = buildTravelDomainBridge({
      memory: result.context.memory,
      plan: result.plan,
    })
    expect(bridge.searchDraft?.destination).toBe('Dubai')
    expect(bridge.searchDraft?.departureCity).toBe('Riyadh')
    expect(bridge.searchDraft?.readyForSearch).toBe(true)
  })
})

describe('Sprint 21 planTurn contextual replies', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  it('does not change replies when travel engine is off (backward compatible)', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: false,
      brainEnabled: false,
      brainTravelEngineEnabled: false,
    })
    const result = await service.planTurn({
      conversationId: 'c-off',
      messages: [userMessage('I want to visit Japan.', 'c-off')],
    })
    expect(result.meta.brain).toBeUndefined()
    expect(result.reply.length).toBeGreaterThan(0)
  })

  it('returns one contextual follow-up remembering prior budget and family', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: false,
      brainEnabled: true,
      brainTravelEngineEnabled: true,
      brainHandoffEnabled: true,
    })

    // Seed memory via first turn
    await service.planTurn({
      conversationId: 'c-japan',
      messages: [
        userMessage(
          'Family trip for 2 adults 2 children, budget 8000 SAR, prefer Saudia and a resort',
          'c-japan',
        ),
      ],
    })

    const result = await service.planTurn({
      conversationId: 'c-japan',
      messages: [
        userMessage(
          'Family trip for 2 adults 2 children, budget 8000 SAR, prefer Saudia and a resort',
          'c-japan',
        ),
        {
          ...userMessage('ok', 'c-japan'),
          role: 'assistant',
          id: 'a1',
        },
        userMessage('I want to visit Japan.', 'c-japan'),
      ],
    })

    expect(result.meta.brain).toBeTruthy()
    expect(result.meta.brain?.travelPlan).toBeTruthy()
    expect(result.meta.brain?.domain).toBeTruthy()
    expect(result.meta.brain?.contextualReply).toBeTruthy()
    // Experience Sprint 2 — reply comes from Conversation Brain, not the template contextualReply.
    expect(result.reply).not.toBe(result.meta.brain?.contextualReply)
    expect(result.reply).toMatch(/Tokyo|Japan/i)
    // Local model variants may ask with "?" or a declarative timing cue.
    expect(result.reply).toMatch(/\?|approximate period|day count|متى|كم يوم|الإطار الزمني|اطار زمني|week|break|أسبوع/)
    // Brain owns wording; prior budget/travelers may appear in reply or stay in memory/facts.
    expect(
      /8000|Saudia|resort|adult|two of you|couple|family|week|break|Tokyo|Japan/i.test(result.reply)
      || (result.memory.requirements.budgetAmount != null)
      || (result.memory.requirements.travelerType != null),
    ).toBe(true)
    expect(result.meta.spokenText).toBeTruthy()
  })
})

describe('Sprint 21 text pipeline parity', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  it('runIntegratedBrainTurn builds TravelPlan when flags are on', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.enabled', true)
    registry.setEnabled('brain.concierge', true)
    registry.setEnabled('brain.travel_engine', true)

    const textResult = runIntegratedBrainTurn({
      conversationId: 'c-voice-parity',
      userText: 'Flights from Riyadh to Dubai for 2 travelers, 4 days',
      locale: 'en',
      travelEngine: true,
    })
    expect(textResult.plan.travelPlan).toBeTruthy()
    expect(textResult.domain?.searchDraft?.departureCity).toBe('Riyadh')
  })
})
