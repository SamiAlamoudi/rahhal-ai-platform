/**
 * Sprint 9 Phase 1 — Concierge domain model & dialogue state.
 */
import { describe, expect, it } from 'vitest'
import { emptyMemory, emptyRequirements, withTripPlan } from '../agent/types'
import type { TripPlan } from '../agent/types'
import {
  advanceConciergeState,
  emptyConciergeState,
  emptySoftSignals,
  hardMissingCount,
  hasSoftDepth,
  mergeSoftSignals,
  resolveConciergePhase,
} from '../concierge'

function stubPlan(): TripPlan {
  return {
    id: 'plan-1',
    title: 'Test',
    summary: 'Test plan',
    locale: 'en',
    destinations: ['Paris'],
    startDate: null,
    endDate: null,
    durationDays: 5,
    travelers: 2,
    travelerType: 'couple',
    interests: [],
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
    estimatedBudget: { amount: 1000, currency: 'USD', breakdown: [] },
    estimatedCosts: { amount: 1000, currency: 'USD', breakdown: [] },
    notes: [],
    conversationId: 'c1',
    requirements: emptyRequirements(),
    updatedAt: new Date().toISOString(),
  }
}

describe('Concierge Phase 1 — domain model', () => {
  it('starts in greeting with empty soft signals', () => {
    const state = emptyConciergeState()
    expect(state.phase).toBe('greeting')
    expect(state.turnCount).toBe(0)
    expect(state.lastAction).toBeNull()
    expect(state.softSignals).toEqual(emptySoftSignals())
  })

  it('merges soft signals without duplicates', () => {
    const merged = mergeSoftSignals(emptySoftSignals(), {
      pace: 'relaxed',
      mustHaves: ['beach', 'Beach'],
      dealBreakers: ['long layovers'],
    })
    expect(merged.pace).toBe('relaxed')
    expect(merged.mustHaves).toEqual(['beach'])
    expect(merged.dealBreakers).toEqual(['long layovers'])
    expect(hasSoftDepth(merged)).toBe(true)
    expect(hasSoftDepth(emptySoftSignals())).toBe(false)
  })

  it('counts only hard intake missing fields', () => {
    expect(hardMissingCount(['destination', 'interests', 'hotelPreference'])).toBe(1)
    expect(hardMissingCount(['destination', 'durationDays', 'budgetAmount', 'travelers'])).toBe(4)
  })
})

describe('Concierge Phase 1 — dialogue phase machine', () => {
  it('stays in greeting on the first empty turn', () => {
    const memory = emptyMemory('en')
    memory.missingFields = ['destination', 'durationDays', 'budgetAmount', 'travelers']
    const phase = resolveConciergePhase({
      memory,
      previous: null,
      intent: 'plan',
      softSignals: emptySoftSignals(),
    })
    expect(phase).toBe('greeting')
  })

  it('moves to discovery when hard fields are still empty after greeting', () => {
    const memory = emptyMemory('en')
    memory.missingFields = ['destination', 'durationDays', 'budgetAmount', 'travelers']
    const previous = advanceConciergeState({
      previous: emptyConciergeState(),
      phase: 'greeting',
      lastAction: 'greet',
    })
    const phase = resolveConciergePhase({
      memory,
      previous,
      intent: 'plan',
      softSignals: emptySoftSignals(),
    })
    expect(phase).toBe('discovery')
  })

  it('moves to deepening when some hard fields are filled', () => {
    const memory = emptyMemory('en')
    memory.requirements = {
      ...emptyRequirements(),
      destination: 'Paris',
      destinations: ['Paris'],
      durationDays: 5,
    }
    memory.missingFields = ['budgetAmount', 'travelers']
    const previous = advanceConciergeState({
      previous: null,
      phase: 'discovery',
    })
    const phase = resolveConciergePhase({
      memory,
      previous,
      intent: 'answer',
      softSignals: emptySoftSignals(),
    })
    expect(phase).toBe('deepening')
  })

  it('moves to advising when hard intake is complete and soft signals exist', () => {
    const memory = emptyMemory('en')
    memory.missingFields = []
    memory.requirements = {
      ...emptyRequirements(),
      destination: 'Paris',
      destinations: ['Paris'],
      durationDays: 5,
      budgetAmount: 3000,
      budgetCurrency: 'USD',
      travelers: 2,
    }
    const soft = mergeSoftSignals(emptySoftSignals(), { pace: 'relaxed', mustHaves: ['food'] })
    const previous = advanceConciergeState({ previous: null, phase: 'deepening' })
    previous.turnCount = 2
    const phase = resolveConciergePhase({
      memory,
      previous,
      intent: 'answer',
      softSignals: soft,
    })
    expect(phase).toBe('advising')
  })

  it('enters refining when a plan exists and user edits', () => {
    const memory = withTripPlan(emptyMemory('en'), stubPlan())
    memory.missingFields = []
    const phase = resolveConciergePhase({
      memory,
      previous: advanceConciergeState({ previous: null, phase: 'executing' }),
      intent: 'edit',
      softSignals: emptySoftSignals(),
    })
    expect(phase).toBe('refining')
  })

  it('advances turnCount on each state update', () => {
    const a = advanceConciergeState({ previous: null, phase: 'greeting' })
    const b = advanceConciergeState({ previous: a, phase: 'discovery', lastAction: 'ask' })
    expect(a.turnCount).toBe(1)
    expect(b.turnCount).toBe(2)
    expect(b.phase).toBe('discovery')
    expect(b.lastAction).toBe('ask')
  })
})

describe('Concierge Phase 1 — provider agnosticism', () => {
  it('module surface does not export provider identifiers', async () => {
    const mod = await import('../concierge')
    const keys = Object.keys(mod).join(' ')
    expect(keys.toLowerCase()).not.toMatch(/amadeus|duffel|travelport|sabre|expedia|booking\.com/)
  })
})
