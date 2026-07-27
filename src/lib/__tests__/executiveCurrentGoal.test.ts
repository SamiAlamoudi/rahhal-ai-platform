/**
 * Executive Current Goal — five-stage consultation funnel.
 */
import { describe, expect, it } from 'vitest'
import {
  buildTravelFacts,
  deriveExecutiveCurrentGoal,
  EXECUTIVE_CURRENT_GOALS,
  buildConversationUserPayload,
  RAHHAL_CONVERSATION_SYSTEM_PROMPT,
} from '../agent/conversationBrain'
import { emptyMemory, emptyRequirements } from '../agent/types'
import type { TripPlan } from '../agent/types'

function minimalPlan(destination: string): TripPlan {
  const budget = { amount: 8000, currency: 'SAR', breakdown: [] as Array<{ label: string; amount: number }> }
  return {
    id: 'plan-goal',
    title: `${destination} trip`,
    summary: `Plan for ${destination}`,
    locale: 'en',
    destinations: [destination],
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
    estimatedBudget: budget,
    estimatedCosts: budget,
    notes: [],
    conversationId: 'c-goal',
    requirements: emptyRequirements(),
    updatedAt: '2026-07-15T00:00:00.000Z',
    decision: null,
  }
}

describe('Executive Current Goal', () => {
  it('exposes exactly the five executive goals', () => {
    expect([...EXECUTIVE_CURRENT_GOALS]).toEqual([
      'Collect destination',
      'Recommend flights',
      'Compare hotels',
      'Finalize booking',
      'Confirm itinerary',
    ])
  })

  it('system prompt and user payload surface Current Goal', () => {
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/CURRENT GOAL/)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/Collect destination/)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/Recommend flights/)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/Compare hotels/)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/Finalize booking/)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/Confirm itinerary/)

    const payload = buildConversationUserPayload({
      currentGoal: 'Collect destination',
      objective: 'collect_missing',
      factsJson: '{}',
      recentHistory: '(start)',
      currentUserMessage: 'hi',
    })
    expect(payload).toMatch(/^Current Goal: Collect destination/)
    expect(payload).toMatch(/Advance the Current Goal/)
    expect(payload).toMatch(/Never acknowledge-only|Advance, Collect, Recommend, Confirm, or Execute/)
    expect(payload).toMatch(/Infer first\. Recommend second/)
    expect(payload).toMatch(/Execution before explanation|search\/compare\/recommend before asking/i)
  })

  it('Collect destination when destination is unknown', () => {
    const memory = emptyMemory('en')
    const facts = buildTravelFacts({ memory, objective: 'greet_or_continue' })
    expect(facts.currentGoal).toBe('Collect destination')
  })

  it('Recommend flights once destination is known', () => {
    const memory = emptyMemory('en')
    memory.requirements = {
      ...emptyRequirements(),
      destination: 'Japan',
      destinations: ['Japan'],
    }
    const facts = buildTravelFacts({ memory, objective: 'collect_missing', missingSlots: ['durationDays'] })
    expect(facts.currentGoal).toBe('Recommend flights')
  })

  it('Compare hotels when lodging is the active focus', () => {
    const memory = emptyMemory('en')
    memory.requirements = {
      ...emptyRequirements(),
      destination: 'Paris',
      destinations: ['Paris'],
      hotelPreference: 'central',
    }
    const facts = buildTravelFacts({ memory, objective: 'propose_options' })
    expect(facts.currentGoal).toBe('Compare hotels')
  })

  it('Confirm itinerary when a plan exists', () => {
    const memory = emptyMemory('en')
    memory.requirements = {
      ...emptyRequirements(),
      destination: 'Japan',
      destinations: ['Japan'],
    }
    memory.tripPlan = minimalPlan('Japan')
    const facts = buildTravelFacts({ memory, objective: 'present_plan', tripPlan: memory.tripPlan })
    expect(facts.currentGoal).toBe('Confirm itinerary')
  })

  it('Finalize booking when booking intent / checkout is active', () => {
    const memory = emptyMemory('en')
    memory.requirements = {
      ...emptyRequirements(),
      destination: 'Dubai',
      destinations: ['Dubai'],
    }
    memory.tripPlan = minimalPlan('Dubai')
    memory.lastIntent = 'show_checkout'
    const facts = buildTravelFacts({
      memory,
      objective: 'present_plan',
      tripPlan: memory.tripPlan,
    })
    expect(facts.currentGoal).toBe('Finalize booking')
  })

  it('Finalize booking from softSignals even without plan', () => {
    const goal = deriveExecutiveCurrentGoal({
      known: { destination: 'Bali' },
      missingSlots: [],
      plan: null,
      objective: 'advise',
      softSignals: { bookingIntent: 'book_now' },
    })
    expect(goal).toBe('Finalize booking')
  })

  it('lodging missing slot with destination → Compare hotels', () => {
    const goal = deriveExecutiveCurrentGoal({
      known: { destination: 'Istanbul' },
      missingSlots: ['hotelPreference'],
      plan: null,
      objective: 'collect_missing',
    })
    expect(goal).toBe('Compare hotels')
  })
})
