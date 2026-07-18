/**
 * Sprint 9 Phase 5 — agent-only plan/search handoff.
 */
import { describe, expect, it } from 'vitest'
import { emptyMemory, emptyRequirements, withTripPlan } from '../agent/types'
import type { TripPlan } from '../agent/types'
import { createConciergeService } from '../concierge/conciergeService'
import {
  assertProviderAgnosticHandoff,
  resolveAgentHandoff,
} from '../concierge/searchHandoff'
import { advanceConciergeState, emptySoftSignals } from '../concierge'
import { extractSoftSignals } from '../concierge/softSignals'

function completeRequirements() {
  return {
    ...emptyRequirements(),
    destination: 'Paris',
    destinations: ['Paris'],
    durationDays: 5,
    budgetAmount: 4000,
    budgetCurrency: 'USD',
    travelers: 2,
    travelerType: 'couple' as const,
    interests: ['food'],
    budgetStyle: 'midrange' as const,
    hotelPreference: 'central',
    weatherPreference: 'mild',
    packageScope: 'full_package' as const,
  }
}

function stubPlan(): TripPlan {
  return {
    id: 'plan-1',
    title: 'Paris',
    summary: 'Trip',
    locale: 'en',
    destinations: ['Paris'],
    startDate: null,
    endDate: null,
    durationDays: 5,
    travelers: 2,
    travelerType: 'couple',
    interests: ['food'],
    dailyItinerary: [],
    activities: [],
    transportation: [],
    flights: [],
    accommodations: [],
    attractions: [],
    weatherNotes: [],
    visaNotes: [],
    travelTips: [],
    packingSuggestions: [],
    estimatedBudget: { amount: 4000, currency: 'USD', breakdown: [] },
    estimatedCosts: { amount: 4000, currency: 'USD', breakdown: [] },
    notes: [],
    conversationId: 'c1',
    requirements: completeRequirements(),
    updatedAt: new Date().toISOString(),
  }
}

describe('Concierge Phase 5 — search/plan handoff', () => {
  it('keeps discovery turns inside Concierge (no agent execute)', () => {
    const service = createConciergeService()
    const memory = emptyMemory('en')
    memory.missingFields = ['destination', 'durationDays', 'budgetAmount', 'travelers']
    const result = service.runTurn({
      locale: 'en',
      memory,
      userText: 'Hi',
      intent: 'plan',
      requirements: memory.requirements,
      missingFields: memory.missingFields,
      previous: null,
    })
    expect(result.handoff.shouldExecuteAgent).toBe(false)
    expect(result.handoff.mode).toBe('none')
    expect(result.reply).toBeTruthy()
    expect(result.reply!.toLowerCase()).toMatch(/consultant|rahhal/)
  })

  it('hands off plan mode to the agent after confirmation', () => {
    const service = createConciergeService()
    const memory = emptyMemory('en')
    memory.requirements = completeRequirements()
    memory.missingFields = []
    const previous = advanceConciergeState({
      previous: null,
      phase: 'confirming',
      lastAction: 'confirm',
      softSignals: {
        ...emptySoftSignals(),
        pace: 'relaxed',
        mustHaves: ['food'],
      },
    })
    previous.turnCount = 5
    const result = service.runTurn({
      locale: 'en',
      memory,
      userText: 'yes, build the plan',
      intent: 'plan',
      requirements: memory.requirements,
      missingFields: [],
      previous,
    })
    expect(result.handoff.shouldExecuteAgent).toBe(true)
    expect(result.handoff.mode).toBe('plan')
    expect(result.reply).toBeNull()
    expect(() => assertProviderAgnosticHandoff(result.handoff)).not.toThrow()
  })

  it('hands off search mode for flights_only without naming suppliers', () => {
    const service = createConciergeService()
    const memory = emptyMemory('en')
    memory.requirements = { ...completeRequirements(), packageScope: 'flights_only' }
    memory.missingFields = []
    const previous = advanceConciergeState({
      previous: null,
      phase: 'confirming',
      lastAction: 'confirm',
      softSignals: extractSoftSignals('flexible budget', 'en'),
    })
    previous.turnCount = 4
    const result = service.runTurn({
      locale: 'en',
      memory,
      userText: 'yes please do',
      intent: 'plan',
      requirements: memory.requirements,
      missingFields: [],
      previous,
    })
    expect(result.handoff.mode).toBe('search')
    expect(result.handoff.shouldExecuteAgent).toBe(true)
    expect(JSON.stringify(result.handoff).toLowerCase()).not.toMatch(
      /amadeus|duffel|sabre|expedia|travelport/,
    )
  })

  it('hands off refine when editing an existing plan', () => {
    const service = createConciergeService()
    const memory = withTripPlan(emptyMemory('en'), stubPlan())
    memory.requirements = completeRequirements()
    memory.missingFields = []
    const previous = advanceConciergeState({
      previous: null,
      phase: 'executing',
      lastAction: 'plan',
    })
    const result = service.runTurn({
      locale: 'en',
      memory,
      userText: 'Change the hotel area',
      intent: 'edit',
      requirements: memory.requirements,
      missingFields: [],
      previous,
    })
    expect(result.handoff.mode).toBe('refine')
    expect(result.handoff.shouldExecuteAgent).toBe(true)
    expect(result.reply).toBeNull()
  })

  it('propose_options includes AB recommendation lines in Concierge reply', () => {
    const service = createConciergeService()
    const memory = emptyMemory('en')
    memory.requirements = completeRequirements()
    memory.missingFields = []
    const previous = advanceConciergeState({
      previous: null,
      phase: 'deepening',
      softSignals: extractSoftSignals('relaxed food trip', 'en'),
    })
    previous.turnCount = 3
    const result = service.runTurn({
      locale: 'en',
      memory,
      userText: 'What directions would you suggest?',
      intent: 'unknown',
      requirements: memory.requirements,
      missingFields: [],
      previous,
    })
    expect(result.handoff.mode).toBe('none')
    expect(result.decision.action).toBe('propose_options')
    expect(result.reply).toMatch(/1\./)
    expect(result.reply).toMatch(/Paris/i)
  })

  it('resolveAgentHandoff maps actions without provider knowledge', () => {
    const handoff = resolveAgentHandoff({
      action: 'search',
      phase: 'executing',
      state: advanceConciergeState({ previous: null, phase: 'executing', lastAction: 'search' }),
      askFields: [],
      shouldExecuteAgent: true,
      rationale: 'Flights-only scope — agent search handoff (no provider named).',
    })
    expect(handoff.mode).toBe('search')
    assertProviderAgnosticHandoff(handoff)
  })

  it('handoff module surface stays provider-agnostic', async () => {
    const handoff = await import('../concierge/searchHandoff')
    const service = await import('../concierge/conciergeService')
    const keys = `${Object.keys(handoff).join(' ')} ${Object.keys(service).join(' ')}`.toLowerCase()
    expect(keys).not.toMatch(/amadeus|duffel|travelport|sabre|expedia|orchestrate/)
    expect(typeof handoff.resolveAgentHandoff).toBe('function')
    expect(typeof service.createConciergeService).toBe('function')
  })
})
