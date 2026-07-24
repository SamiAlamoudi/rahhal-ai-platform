/**
 * AI Concierge Sprint 1 — value-first consultant conversation regressions.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  evaluateConciergeValueOpportunity,
  recommendDestinationsForBudgetSeason,
} from '../concierge'
import { decideConciergeTurn } from '../concierge/turnPolicy'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import { emptyMemory, emptyRequirements } from '../agent/types'
import { mergeRequirements } from '../agent/memory'
import { extractFromUserText } from '../agent/extractRequirements'
import type { ChatMessage } from '../chat/chatTypes'

function user(content: string, conversationId = 'sprint1'): ChatMessage {
  const now = new Date().toISOString()
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

function countQuestions(text: string): number {
  return (text.match(/\?/g) ?? []).length + (text.match(/؟/g) ?? []).length
}

describe('AI Concierge Sprint 1 — budget + season without destination', () => {
  it('extracts August + bare 5000 SAR without inventing destination or travelers', () => {
    const result = extractFromUserText('I want to travel in August with a budget of 5000 SAR.')
    expect(result.patch.budgetAmount).toBe(5000)
    expect(result.patch.budgetCurrency).toMatch(/SAR/i)
    expect(result.patch.startDate).toMatch(/-08-/)
    expect(result.patch.destination).toBeUndefined()
    expect(result.patch.travelers).toBeUndefined()
  })

  it('recommends catalog destinations from budget + timing (no new hardcoded list)', () => {
    const req = mergeRequirements(emptyRequirements(), {
      budgetAmount: 5000,
      budgetCurrency: 'SAR',
      startDate: '2026-08-15',
    })
    const recs = recommendDestinationsForBudgetSeason({
      requirements: req,
      locale: 'en',
      userText: 'I want to travel in August with a budget of 5000 SAR.',
    })
    expect(recs).toBeTruthy()
    expect(recs!.valueBrief.length).toBeGreaterThanOrEqual(2)
    expect(recs!.framingNote).toMatch(/5,000|5000/i)
    expect(recs!.framingNote).toMatch(/August/i)
    expect(recs!.preferenceQuestion).toMatch(/alone|with others/i)
    expect(recs!.confidence).toBe('medium')
  })

  it('Decision Engine leads with destinations — not Where?/Travelers?/Departure?', () => {
    const assessment = evaluateConciergeValueOpportunity({
      requirements: mergeRequirements(emptyRequirements(), {
        budgetAmount: 5000,
        budgetCurrency: 'SAR',
        startDate: '2026-08-15',
      }),
      locale: 'en',
      userText: 'I want to travel in August with a budget of 5000 SAR.',
      previous: null,
    })
    expect(assessment.canProvideValue).toBe(true)
    expect(assessment.mode).toBe('budget_season_destinations')
    expect(assessment.valueBrief.length).toBeGreaterThanOrEqual(2)
    expect(assessment.preferenceQuestion).toMatch(/alone|with others/i)
  })

  it('turn policy clears askFields and does not execute itinerary yet', () => {
    const memory = emptyMemory('en')
    memory.requirements = mergeRequirements(emptyRequirements(), {
      budgetAmount: 5000,
      budgetCurrency: 'SAR',
      startDate: '2026-08-15',
    })
    memory.missingFields = ['destination', 'durationDays']
    const decision = decideConciergeTurn({
      locale: 'en',
      memory,
      userText: 'I want to travel in August with a budget of 5000 SAR.',
      intent: 'plan',
      requirements: memory.requirements,
      missingFields: memory.missingFields,
      previous: null,
    })
    expect(['propose_options', 'advise']).toContain(decision.action)
    expect(decision.askFields).toEqual([])
    expect(decision.shouldExecuteAgent).toBe(false)
    expect(decision.valueBrief?.length).toBeGreaterThanOrEqual(2)
  })
})

describe('AI Concierge Sprint 1 — live planTurn consultant feel', () => {
  beforeEach(() => resetFeatureRegistry())

  it('August + 5000 SAR → destinations first, one preference question, no form census', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const turn = await service.planTurn({
      conversationId: 's1-budget-august',
      messages: [
        user(
          'I want to travel in August with a budget of 5000 SAR.',
          's1-budget-august',
        ),
      ],
    })

    expect(turn.memory.requirements.budgetAmount).toBe(5000)
    expect(turn.memory.requirements.travelers).toBeNull()
    expect(turn.memory.requirements.destination).toBeNull()

    expect(turn.reply).toMatch(/5,000|5000/i)
    expect(turn.reply).toMatch(/August/i)
    // Catalog-backed destinations (examples vary by ranking).
    expect(turn.reply).toMatch(/Tbilisi|Marrakech|Cairo|Baku|Istanbul|Amman|Salalah|Bali|Cappadocia/i)
    expect(turn.reply.toLowerCase()).toMatch(/alone|with others|solo|family|travelling/)

    // Forbidden form behaviour.
    expect(turn.reply).not.toMatch(/\bWhere do you want to go\b/i)
    expect(turn.reply).not.toMatch(/\bHow many (travelers|people)\b/i)
    expect(turn.reply).not.toMatch(/\bDeparture city\b|\bWhere are you flying\b/i)
    expect(turn.reply).not.toMatch(/\bWhat is your (budget|nationality)\b/i)
    expect(turn.reply).not.toMatch(/planningDraft|missingAssumptions|"kind"\s*:/i)

    // One question max (preference closer).
    expect(countQuestions(turn.reply)).toBeLessThanOrEqual(1)
  })

  it('Morocco alone still leads with cities (Planning Draft / Decision Engine intact)', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const turn = await service.planTurn({
      conversationId: 's1-morocco',
      messages: [user('I want to travel to Morocco.', 's1-morocco')],
    })
    expect(turn.reply).toMatch(/Agadir|Marrakech|Casablanca/i)
    expect(turn.reply).not.toMatch(/\bBudget\?\b|\bHow many days\b/i)
    expect(countQuestions(turn.reply)).toBeLessThanOrEqual(1)
  })

  it('never invents traveler count when value-leading', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const turn = await service.planTurn({
      conversationId: 's1-no-invent',
      messages: [
        user('Morocco in August, budget 5000 SAR', 's1-no-invent'),
      ],
    })
    expect(turn.memory.requirements.travelers).toBeNull()
    expect(turn.meta.planningDraft?.travelerCount ?? null).toBeNull()
    expect(turn.reply).not.toMatch(/\bfor two\b|\b2 travelers\b|\btwo people\b/i)
  })

  it('does not ask departure city on a value-first Morocco beat', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const turn = await service.planTurn({
      conversationId: 's1-no-origin',
      messages: [user('I want Morocco with 5000 SAR in August for 7 days', 's1-no-origin')],
    })
    expect(turn.reply).toMatch(/Agadir|Marrakech/i)
    expect(turn.reply).not.toMatch(/\bWhich city will you depart\b|\bDeparture city\b|\bflying out of\b/i)
    expect(countQuestions(turn.reply)).toBeLessThanOrEqual(1)
  })
})
