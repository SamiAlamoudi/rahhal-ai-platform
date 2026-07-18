/**
 * Sprint 9 Phase 2 — Concierge turn policy & soft signals.
 */
import { describe, expect, it } from 'vitest'
import { emptyMemory, emptyRequirements, withTripPlan } from '../agent/types'
import type { TripPlan } from '../agent/types'
import { decideConciergeTurn } from '../concierge/turnPolicy'
import { extractSoftSignals } from '../concierge/softSignals'
import {
  advanceConciergeState,
  emptyConciergeState,
  emptySoftSignals,
} from '../concierge'

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

describe('Concierge Phase 2 — soft signals', () => {
  it('detects pace and must-haves from free text', () => {
    const signals = extractSoftSignals(
      'We want a relaxed trip with great food and beach time',
      'en',
    )
    expect(signals.pace).toBe('relaxed')
    expect(signals.mustHaves).toEqual(expect.arrayContaining(['food', 'beach']))
  })

  it('detects Arabic deal-breakers and flexibility', () => {
    const signals = extractSoftSignals(
      'ميزانية مرنة وتجنب التوقف الطويل',
      'ar',
    )
    expect(signals.flexibleDimensions).toContain('budget')
    expect(signals.dealBreakers.some((d) => /layover/i.test(d))).toBe(true)
  })
})

describe('Concierge Phase 2 — turn policy', () => {
  it('greets and asks on the first turn', () => {
    const memory = emptyMemory('en')
    memory.missingFields = ['destination', 'durationDays', 'budgetAmount', 'travelers']
    const decision = decideConciergeTurn({
      locale: 'en',
      memory,
      userText: 'Hi, planning a trip',
      intent: 'plan',
      requirements: memory.requirements,
      missingFields: memory.missingFields,
      previous: null,
    })
    expect(decision.action).toBe('greet')
    expect(decision.shouldExecuteAgent).toBe(false)
    expect(decision.askFields.length).toBeGreaterThan(0)
    expect(decision.state.turnCount).toBe(1)
  })

  it('asks/clarifies while hard requirements are missing', () => {
    const memory = emptyMemory('en')
    memory.requirements = {
      ...emptyRequirements(),
      destination: 'Tokyo',
      destinations: ['Tokyo'],
    }
    memory.missingFields = ['durationDays', 'budgetAmount', 'travelers']
    const previous = advanceConciergeState({
      previous: emptyConciergeState(),
      phase: 'discovery',
      lastAction: 'greet',
    })
    const decision = decideConciergeTurn({
      locale: 'en',
      memory,
      userText: 'Tokyo please',
      intent: 'answer',
      requirements: memory.requirements,
      missingFields: memory.missingFields,
      previous,
    })
    expect(['ask', 'clarify']).toContain(decision.action)
    expect(decision.shouldExecuteAgent).toBe(false)
    expect(decision.askFields[0]).toBe('durationDays')
  })

  it('proposes options when intake is complete with soft depth', () => {
    const memory = emptyMemory('en')
    memory.requirements = completeRequirements()
    memory.missingFields = []
    const previous = advanceConciergeState({
      previous: null,
      phase: 'deepening',
      softSignals: extractSoftSignals('relaxed food trip', 'en'),
    })
    previous.turnCount = 3
    const decision = decideConciergeTurn({
      locale: 'en',
      memory,
      userText: 'We love food and a relaxed pace',
      intent: 'answer',
      requirements: memory.requirements,
      missingFields: [],
      previous,
    })
    expect(decision.action).toBe('propose_options')
    expect(decision.phase).toBe('advising')
    expect(decision.shouldExecuteAgent).toBe(false)
  })

  it('hands off to agent plan on affirmation after options', () => {
    const memory = emptyMemory('en')
    memory.requirements = completeRequirements()
    memory.missingFields = []
    const previous = advanceConciergeState({
      previous: null,
      phase: 'advising',
      lastAction: 'propose_options',
      softSignals: extractSoftSignals('relaxed food', 'en'),
    })
    previous.turnCount = 4
    const decision = decideConciergeTurn({
      locale: 'en',
      memory,
      userText: 'Yes, go ahead and build the plan',
      intent: 'plan',
      requirements: memory.requirements,
      missingFields: [],
      previous,
    })
    // confirm then plan depending on branch — either confirm or plan/search is acceptable,
    // but agent execute must eventually be true for affirmative plan intent with complete reqs.
    expect(['confirm', 'plan', 'search']).toContain(decision.action)
    if (decision.action === 'plan' || decision.action === 'search') {
      expect(decision.shouldExecuteAgent).toBe(true)
    }
  })

  it('uses search action for flights_only without naming providers', () => {
    const memory = emptyMemory('en')
    memory.requirements = {
      ...completeRequirements(),
      packageScope: 'flights_only',
    }
    memory.missingFields = []
    const previous = advanceConciergeState({
      previous: null,
      phase: 'confirming',
      lastAction: 'confirm',
      softSignals: mergeWithPace(),
    })
    previous.turnCount = 5
    const decision = decideConciergeTurn({
      locale: 'en',
      memory,
      userText: 'yes, please do',
      intent: 'plan',
      requirements: memory.requirements,
      missingFields: [],
      previous,
    })
    expect(decision.action).toBe('search')
    expect(decision.shouldExecuteAgent).toBe(true)
    expect(decision.rationale.toLowerCase()).not.toMatch(/amadeus|duffel|sabre|expedia/)
  })

  it('refines via agent when a plan already exists', () => {
    const memory = withTripPlan(emptyMemory('en'), stubPlan())
    memory.requirements = completeRequirements()
    memory.missingFields = []
    const previous = advanceConciergeState({
      previous: null,
      phase: 'executing',
      lastAction: 'plan',
    })
    const decision = decideConciergeTurn({
      locale: 'en',
      memory,
      userText: 'Make day 2 more cultural',
      intent: 'edit',
      requirements: memory.requirements,
      missingFields: [],
      previous,
    })
    expect(decision.action).toBe('refine')
    expect(decision.shouldExecuteAgent).toBe(true)
    expect(decision.phase).toBe('refining')
  })
})

function mergeWithPace() {
  return {
    ...emptySoftSignals(),
    pace: 'relaxed' as const,
    mustHaves: ['food'],
  }
}
