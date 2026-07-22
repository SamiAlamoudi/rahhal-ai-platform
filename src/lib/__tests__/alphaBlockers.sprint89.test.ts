/**
 * Sprint 89 — constitution live wiring + package fallback + recovery smoke.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTravelAgentService } from '../agent/travelAgentService'
import { applyConstitutionToTurn } from '../agent/constitution'
import { enrichWithDynamicPackages } from '../agent/packageBuilder'
import { mergeRequirements } from '../agent/memory'
import { resetFeatureRegistry } from '../ai'
import type { ChatMessage } from '../chat/chatTypes'
import { emptyMemory, emptyRequirements, type TripPlan } from '../agent/types'

function msg(role: 'user' | 'assistant', content: string, conversationId: string): ChatMessage {
  return {
    id: `${role}-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    role,
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
  }
}

function minimalPlan(destination: string): TripPlan {
  const requirements = mergeRequirements(emptyRequirements(), {
    destination,
    destinations: [destination],
    durationDays: 5,
    travelers: 2,
    budgetAmount: 10000,
    budgetCurrency: 'SAR',
    origin: 'Riyadh',
  })
  const budget = { amount: 8000, currency: 'SAR', breakdown: [] as Array<{ label: string; amount: number; currency: string }> }
  return {
    id: 'plan-s89',
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
    conversationId: 'c-s89',
    requirements,
    updatedAt: '2026-07-22T00:00:00.000Z',
    decision: null,
  }
}

describe('Sprint 89 constitution bridge', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('validates a recommendation turn with reason/tradeoffs/confidence/alternatives', () => {
    const memory = emptyMemory('en')
    memory.requirements = mergeRequirements(emptyRequirements(), {
      destination: 'Dubai',
      destinations: ['Dubai'],
      tripPurpose: 'honeymoon',
      budgetAmount: 20000,
      travelers: 2,
    })
    memory.missingFields = []
    const result = applyConstitutionToTurn({
      userText: 'No, not this. Show something else',
      memory,
      tripPlan: minimalPlan('Dubai'),
      replyText: 'Here is a closer romantic option with alternatives.',
      intent: 'edit',
      confidence: 0.8,
      packagesPresent: true,
      alternativeCount: 2,
    })
    expect(result.enabled).toBe(true)
    expect(result.meta.ok).toBe(true)
    expect(result.recommendationFacts.some((f) => /^Reason:/i.test(f))).toBe(true)
    expect(result.recommendationFacts.some((f) => /Trade-offs:/i.test(f))).toBe(true)
    expect(result.recommendationFacts.some((f) => /Confidence:/i.test(f))).toBe(true)
    expect(result.recommendationFacts.some((f) => /Alternatives:/i.test(f))).toBe(true)
    expect(result.recommendationFacts.some((f) => /Next action:/i.test(f))).toBe(true)
    expect(result.recoveryNotes.length).toBeGreaterThan(0)
    expect(result.snapshot.recoveredWithoutRestart).toBe(true)
  })
})

describe('Sprint 89 package builder fallbacks', () => {
  it('never returns null packages when pools are empty — explains recovery', async () => {
    const memory = emptyMemory('en')
    memory.requirements = mergeRequirements(emptyRequirements(), {
      destination: 'Cairo',
      destinations: ['Cairo'],
      budgetAmount: 5000,
    })
    const out = await enrichWithDynamicPackages({
      memory,
      tripPlan: minimalPlan('Cairo'),
      flightOffers: [],
      hotelStays: [],
    })
    expect(out.dynamicPackages).not.toBeNull()
    expect(out.dynamicPackages?.selected?.explanation).toMatch(/recovery|offers|flexible|nearby/i)
    expect(out.tripPlan.notes.join(' ')).toMatch(/Package builder/i)
  })

  it('builds flight-first partial when hotels missing', async () => {
    const memory = emptyMemory('en')
    memory.requirements = mergeRequirements(emptyRequirements(), {
      destination: 'London',
      destinations: ['London'],
    })
    const out = await enrichWithDynamicPackages({
      memory,
      tripPlan: minimalPlan('London'),
      flightOffers: [{ id: 'f1', airline: 'Saudia', price: 1200, currency: 'SAR', origin: 'RUH', destination: 'LHR' }],
      hotelStays: [],
    })
    expect(out.dynamicPackages?.selected?.title).toMatch(/Flight-first/i)
    expect(out.dynamicPackages?.selected?.explanation).toMatch(/Tradeoffs|Confidence|Next/i)
  })
})

describe('Sprint 89 live planTurn constitution meta', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('attaches constitution meta on a traveler turn', async () => {
    const conversationId = 's89-const'
    const service = createTravelAgentService({
      concierge: false,
      autonomousAgentEnabled: true,
    })
    const turn = await service.planTurn({
      conversationId,
      messages: [
        msg(
          'user',
          'Family vacation from Riyadh to Paris, budget 15000 SAR, 2 adults and 2 children, 7 days',
          conversationId,
        ),
      ],
    })
    expect(turn.meta.constitution?.enabled).toBe(true)
    expect(turn.meta.constitution?.checkedPrinciples?.length).toBeGreaterThan(0)
    expect(turn.reply.length).toBeGreaterThan(20)
    expect(turn.reply).not.toMatch(/\bimpossible\b|\bwrong\b|\bcannot\b/i)
  }, 60_000)
})
