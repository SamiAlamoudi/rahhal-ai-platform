/**
 * Sprint 22 — Multi-Step AI Trip Planning Engine tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'
import {
  TripPlanningEngine,
  detectMissingPlanningFields,
  isBrainTripPlanningEnabled,
  resetBrainIntegrationSessions,
  resetTripPlanningSessions,
  runIntegratedBrainTurn,
} from '../brain'
import { createMockVoiceProvider, createVoiceSession } from '../voiceConversation'

function userMessage(content: string, conversationId = 'c-s22'): ChatMessage {
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

describe('Sprint 22 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  it('registers brain.trip_planning disabled by default', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('brain.trip_planning')).toBe(false)
    expect(isBrainTripPlanningEnabled()).toBe(false)
  })

  it('requires brain.travel_engine before trip_planning', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.trip_planning', true)
    expect(registry.isEnabled('brain.trip_planning')).toBe(false)
    registry.setEnabled('brain.enabled', true)
    registry.setEnabled('brain.concierge', true)
    registry.setEnabled('brain.travel_engine', true)
    expect(registry.isEnabled('brain.trip_planning')).toBe(true)
    expect(isBrainTripPlanningEnabled()).toBe(true)
  })
})

describe('Sprint 22 planner state transitions', () => {
  beforeEach(() => {
    resetTripPlanningSessions()
  })

  afterEach(() => {
    resetTripPlanningSessions()
  })

  it('visits collect → update_memory → detect_missing → clarify when incomplete', () => {
    const engine = TripPlanningEngine({ conversationId: 'c-stages', locale: 'en' })
    const result = engine.runTurn({ userText: 'I want to visit Japan' })
    expect(result.stagesVisited).toEqual(
      expect.arrayContaining(['collect', 'update_memory', 'detect_missing', 'clarify']),
    )
    expect(result.stage).toBe('clarify')
    expect(result.clarification.singleQuestion).toBe(true)
    expect(result.clarification.question).toBeTruthy()
    expect((result.clarification.question!.match(/\?/g) ?? []).length).toBe(1)
  })

  it('reaches produce_plan → complete when required slots are filled', () => {
    const engine = TripPlanningEngine({ conversationId: 'c-complete', locale: 'en' })
    engine.runTurn({
      userText: 'Trip from Riyadh to Dubai for 2 adults, 5 days, budget 8000 SAR',
    })
    // May still miss nothing if all required filled in one shot
    const session = engine.getSession()
    const missing = detectMissingPlanningFields(session)
    if (missing.length) {
      const ask = missing[0]
      const answers: Record<string, string> = {
        destination: 'Dubai',
        departureCity: 'Riyadh',
        travelDates: 'for 5 days',
        travelerCount: '2 travelers',
      }
      const result = engine.runTurn({ userText: answers[ask] ?? '5 days with 2 travelers' })
      expect(result.stagesVisited).toContain('produce_plan')
      expect(result.stage).toBe('complete')
      expect(result.tripPlan?.status).toBe('complete')
      expect(result.tripPlan?.agentTripPlan).toBeTruthy()
    } else {
      // First turn already complete
      const result = engine.runTurn({ userText: 'confirm the plan' })
      expect(result.stage).toBe('complete')
      expect(result.tripPlan?.status).toBe('complete')
    }
  })
})

describe('Sprint 22 complete vs partial planning', () => {
  beforeEach(() => resetTripPlanningSessions())
  afterEach(() => resetTripPlanningSessions())

  it('produces a complete TripPlan, ClarificationPlan, and TravelSummary', () => {
    const engine = TripPlanningEngine({ conversationId: 'c-full', locale: 'en' })
    const result = engine.runTurn({
      userText:
        'Plan a trip from Jeddah to Paris for 2 adults 1 child, 7 days, business class, Saudia, boutique hotel',
    })

    expect(result.travelSummary).toBeTruthy()
    expect(result.travelSummary.headline.length).toBeGreaterThan(0)
    expect(result.clarification).toBeTruthy()

    if (result.stage === 'complete') {
      expect(result.tripPlan?.status).toBe('complete')
      expect(result.tripPlan?.destination).toBe('Paris')
      expect(result.tripPlan?.departureCity).toBe('Jeddah')
      expect(result.tripPlan?.adults).toBe(2)
      expect(result.tripPlan?.children).toBe(1)
      expect(result.tripPlan?.agentTripPlan?.dailyItinerary.length).toBeGreaterThan(0)
      expect(result.travelSummary.completeness).toBe(1)
    } else {
      expect(result.stage).toBe('clarify')
      expect(result.tripPlan?.status).toBe('partial')
      expect(result.clarification.question).toBeTruthy()
    }
  })

  it('partial planning keeps known slots and asks only one missing field', () => {
    const engine = TripPlanningEngine({ conversationId: 'c-partial', locale: 'en' })
    const t1 = engine.runTurn({ userText: 'Family trip to Tokyo, budget 10000 SAR, prefer Emirates' })
    expect(t1.session.destination).toBe('Tokyo')
    expect(t1.session.budget.amount).toBe(10000)
    expect(t1.session.airlinePreferences).toContain('Emirates')
    expect(t1.stage).toBe('clarify')
    expect(t1.clarification.field).toBeTruthy()
    expect(t1.travelSummary.knownSlots).toEqual(
      expect.arrayContaining(['destination', 'budget', 'airlinePreferences']),
    )

    const asked = t1.clarification.field
    const t2 = engine.runTurn({
      userText:
        asked === 'travelDates'
          ? 'for 6 days'
          : asked === 'travelerCount'
            ? '2 adults 2 children'
            : 'for 6 days with 2 adults 2 children',
    })
    expect(t2.session.destination).toBe('Tokyo')
    expect(t2.session.budget.amount).toBe(10000)
  })
})

describe('Sprint 22 corrections without restart', () => {
  beforeEach(() => resetTripPlanningSessions())
  afterEach(() => resetTripPlanningSessions())

  it('updates destination only for Kyoto instead of Tokyo', () => {
    const engine = TripPlanningEngine({ conversationId: 'c-corr', locale: 'en' })
    engine.runTurn({
      userText: 'Trip from Riyadh to Tokyo for 2 travelers, 5 days, budget 9000 SAR',
    })
    const before = engine.getSession()
    expect(before.destination).toBe('Tokyo')

    const result = engine.runTurn({
      userText: 'I actually want Kyoto instead of Tokyo.',
    })
    expect(result.corrections.some((c) => c.kind === 'destination')).toBe(true)
    expect(result.session.destination).toBe('Kyoto')
    expect(result.session.departureCity).toBe(before.departureCity)
    expect(result.session.travelerCount).toBe(before.travelerCount)
    expect(result.session.budget.amount).toBe(before.budget.amount)
    // Did not restart to empty collect-only state
    expect(result.session.answeredFields).toEqual(
      expect.arrayContaining(['destination', 'travelDates', 'travelerCount']),
    )
  })

  it('supports date, traveler, hotel, budget, and cheaper-flight corrections', () => {
    const engine = TripPlanningEngine({ conversationId: 'c-corr2', locale: 'en' })
    engine.runTurn({
      userText: 'Dubai from Jeddah, 4 days, 2 adults, budget 5000 SAR, resort',
    })

    const dates = engine.runTurn({ userText: 'Change to different dates: 2026-10-01 to 2026-10-08' })
    expect(dates.session.travelDates.startDate).toBe('2026-10-01')
    expect(dates.corrections.some((c) => c.kind === 'travelDates')).toBe(true)

    const pax = engine.runTurn({ userText: 'Add 1 more traveler' })
    expect(pax.session.travelerCount).toBeGreaterThan(2)
    expect(pax.corrections.some((c) => c.kind === 'travelers')).toBe(true)

    const hotel = engine.runTurn({ userText: 'I want a better hotel' })
    expect(hotel.session.hotelPreferences).toContain('upgraded')
    expect(hotel.corrections.some((c) => c.kind === 'hotel_upgrade')).toBe(true)

    const budget = engine.runTurn({ userText: 'Higher budget please' })
    expect(budget.session.budget.amount).toBeGreaterThan(5000)
    expect(budget.corrections.some((c) => c.kind === 'budget_increase')).toBe(true)

    const cheap = engine.runTurn({ userText: 'Look for a cheaper flight' })
    expect(cheap.session.notes).toMatch(/cheaper_flight/)
    expect(cheap.corrections.some((c) => c.kind === 'cheaper_flight')).toBe(true)
  })
})

describe('Sprint 22 memory updates + never re-ask', () => {
  beforeEach(() => resetTripPlanningSessions())
  afterEach(() => resetTripPlanningSessions())

  it('never asks for information already stored in memory', () => {
    const engine = TripPlanningEngine({ conversationId: 'c-mem', locale: 'en' })
    const t1 = engine.runTurn({ userText: 'I want to go to Bali' })
    expect(t1.clarification.field).not.toBe('destination')
    expect(t1.session.askedFields.length).toBe(1)

    const asked = t1.session.askedFields[0]
    const t2 = engine.runTurn({ userText: 'still planning Bali' })
    expect(t2.session.destination).toBe('Bali')
    expect(t2.clarification.field).not.toBe(asked)
    expect(t2.clarification.field).not.toBe('destination')
  })
})

describe('Sprint 22 planTurn + voice parity', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  it('does not attach planning when flags are off (backward compatible)', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: false,
      brainEnabled: false,
      brainTripPlanningEnabled: false,
    })
    const result = await service.planTurn({
      conversationId: 'c-off',
      messages: [userMessage('Plan a trip to Dubai', 'c-off')],
    })
    expect(result.meta.brain).toBeUndefined()
  })

  it('returns clarification from TripPlanningEngine when enabled', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: false,
      brainEnabled: true,
      brainTravelEngineEnabled: true,
      brainTripPlanningEnabled: true,
    })
    const result = await service.planTurn({
      conversationId: 'c-plan-on',
      messages: [userMessage('I want to visit Japan.', 'c-plan-on')],
    })
    expect(result.meta.brain?.planning).toBeTruthy()
    expect(result.meta.brain?.clarificationQuestion).toBeTruthy()
    expect(result.reply).toBe(result.meta.brain?.clarificationQuestion)
    expect((result.reply.match(/\?/g) ?? []).length).toBe(1)
  })

  it('text and voice share the same TripPlanningEngine pipeline', async () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.enabled', true)
    registry.setEnabled('brain.concierge', true)
    registry.setEnabled('brain.travel_engine', true)
    registry.setEnabled('brain.trip_planning', true)
    registry.setEnabled('brain.voice', true)

    const text = runIntegratedBrainTurn({
      conversationId: 'c-parity',
      userText: 'Flights from Riyadh to Dubai for 2 travelers, 4 days',
      locale: 'en',
      tripPlanning: true,
    })
    expect(text.planning).toBeTruthy()
    const planning = text.planning as {
      stage: string
      tripPlan: { destination: string | null } | null
      session: { destination: string | null }
    }
    expect(planning.session.destination).toBe('Dubai')

    const session = createVoiceSession({
      conversationId: 'c-parity-v',
      provider: createMockVoiceProvider(),
    })
    await session.start()
    session.commitUserUtterance('Flights from Riyadh to Dubai for 2 travelers, 4 days')
    expect(session.getSnapshot().lastBrainPlan).toBeTruthy()
    session.dispose()
  })
})
