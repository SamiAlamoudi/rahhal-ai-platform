/**
 * Planning Draft — deterministic trip intelligence (not itinerary, not bookings).
 * Audit: no invented traveler counts; estimates are ranges with confidence + reason.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  buildPlanningDraft,
  canBuildPlanningDraft,
  planningDraftToInsightLines,
  resolveTravelerCount,
  resolveDurationDays,
} from '../agent/planningDraft'
import type { PlanningEstimate } from '../agent/planningDraft'
import { emptyRequirements } from '../agent/types'
import { mergeRequirements } from '../agent/memory'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import type { ChatMessage } from '../chat/chatTypes'
import { emptyMemory } from '../agent/types'

function user(content: string, conversationId = 'conv-draft'): ChatMessage {
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

function assistant(
  content: string,
  memory: ReturnType<typeof emptyMemory>,
  conversationId = 'conv-draft',
): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `a-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    role: 'assistant',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {
      kind: 'travel_agent',
      version: 2,
      memory,
    },
    createdAt: now,
    updatedAt: now,
  }
}

function expectEstimate(est: PlanningEstimate) {
  expect(est.low).toBeTypeOf('number')
  expect(est.mid).toBeTypeOf('number')
  expect(est.high).toBeTypeOf('number')
  expect(est.low).toBeLessThanOrEqual(est.mid)
  expect(est.mid).toBeLessThanOrEqual(est.high)
  expect(est.high).toBeGreaterThanOrEqual(est.low)
  expect(est.reason.length).toBeGreaterThan(3)
  expect(['low', 'medium', 'high']).toContain(est.confidence)
}

describe('Planning Draft — readiness', () => {
  it('does not draft on destination alone', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
    })
    expect(canBuildPlanningDraft(req)).toBe(false)
    expect(buildPlanningDraft({ requirements: req, locale: 'en' })).toBeNull()
  })

  it('drafts when destination + timing exist', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      startDate: '2026-08-15',
    })
    expect(canBuildPlanningDraft(req)).toBe(true)
  })
})

describe('Planning Draft — no hidden traveler assumptions', () => {
  it('resolveTravelerCount stays null when not extracted', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      durationDays: 7,
      budgetAmount: 5000,
    })
    expect(req.travelers).toBeNull()
    expect(req.travelerType).toBeNull()
    expect(resolveTravelerCount(req)).toBeNull()
  })

  it('never invents travelerCount=2 on Morocco budget draft', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      durationDays: 7,
      startDate: '2026-08-01',
      budgetAmount: 5000,
      budgetCurrency: 'SAR',
    })
    const draft = buildPlanningDraft({ requirements: req, locale: 'en' })!
    expect(draft.travelerCount).toBeNull()
    expect(draft.missingAssumptions).toContain('traveler count unknown')
    expect(draft.confidence).not.toBe('high')
  })

  it('uses explicit travelers when extracted', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      durationDays: 7,
      budgetAmount: 5000,
      budgetCurrency: 'SAR',
      travelers: 2,
      travelerType: 'couple',
    })
    const draft = buildPlanningDraft({ requirements: req, locale: 'en' })!
    expect(draft.travelerCount).toBe(2)
    expect(draft.missingAssumptions).not.toContain('traveler count unknown')
  })

  it('maps solo travelerType to 1 without inventing a couple', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Tokyo',
      destinations: ['Tokyo'],
      durationDays: 5,
      budgetAmount: 8000,
      travelerType: 'solo',
    })
    expect(resolveTravelerCount(req)).toBe(1)
    expect(buildPlanningDraft({ requirements: req, locale: 'en' })!.travelerCount).toBe(1)
  })

  it('family without count stays null', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Japan',
      destinations: ['Japan'],
      durationDays: 7,
      budgetAmount: 12000,
      travelerType: 'family',
    })
    expect(resolveTravelerCount(req)).toBeNull()
    expect(buildPlanningDraft({ requirements: req, locale: 'en' })!.travelerCount).toBeNull()
  })
})

describe('Planning Draft — no silent duration default as fact', () => {
  it('durationDays is null when only a month hint exists', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      startDate: '2026-08-15',
      budgetAmount: 5000,
      budgetCurrency: 'SAR',
    })
    expect(resolveDurationDays(req)).toBeNull()
    const draft = buildPlanningDraft({ requirements: req, locale: 'en' })!
    expect(draft.durationDays).toBeNull()
    expect(draft.recommendedDurationDays).toBe(7)
    expect(draft.missingAssumptions.some((m) => /duration unknown/i.test(m))).toBe(true)
  })

  it('keeps explicit durationDays', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      durationDays: 7,
      budgetAmount: 5000,
    })
    const draft = buildPlanningDraft({ requirements: req, locale: 'en' })!
    expect(draft.durationDays).toBe(7)
    expect(draft.recommendedDurationDays).toBeNull()
  })
})

describe('Planning Draft — ranged estimates with confidence + reason', () => {
  it('every breakdown line is a range with confidence and reason', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      durationDays: 7,
      startDate: '2026-08-01',
      budgetAmount: 5000,
      budgetCurrency: 'SAR',
    })
    const draft = buildPlanningDraft({ requirements: req, locale: 'en' })!
    expectEstimate(draft.breakdown.flights)
    expectEstimate(draft.breakdown.hotels)
    expectEstimate(draft.breakdown.food)
    expectEstimate(draft.breakdown.transportation)
    expectEstimate(draft.breakdown.activities)
    expectEstimate(draft.breakdown.estimatedTotal)
    expectEstimate(draft.dailySpendEstimate)
    for (const city of draft.cities) {
      expectEstimate(city.estimatedTotal)
      expectEstimate(city.hotelNightly)
    }
  })

  it('flight range cites unknown departure city', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      durationDays: 7,
      budgetAmount: 5000,
      budgetCurrency: 'SAR',
    })
    const draft = buildPlanningDraft({ requirements: req, locale: 'en' })!
    expect(draft.breakdown.flights.low).toBeLessThan(draft.breakdown.flights.high)
    expect(draft.breakdown.flights.reason).toMatch(/departure city unknown/i)
    expect(draft.breakdown.flights.confidence).toBe('low')
  })

  it('hotel estimate cites August pricing for Agadir when ranked first', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      durationDays: 7,
      startDate: '2026-08-01',
      budgetAmount: 5000,
      budgetCurrency: 'SAR',
    })
    const draft = buildPlanningDraft({ requirements: req, locale: 'en' })!
    expect(draft.rankedCities[0]).toBe('Agadir')
    expect(draft.breakdown.hotels.reason).toMatch(/August|Agadir/i)
    expect(draft.cities[0]!.hotelNightly.reason).toMatch(/August|Agadir/i)
  })

  it('is deterministic across identical inputs', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      durationDays: 7,
      budgetAmount: 5000,
      budgetCurrency: 'SAR',
      startDate: '2026-08-15',
    })
    const a = buildPlanningDraft({ requirements: req, locale: 'en' })
    const b = buildPlanningDraft({ requirements: req, locale: 'en' })
    expect(a).toEqual(b)
  })

  it('insight lines use ranges and never look like raw JSON keys', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      durationDays: 7,
      budgetAmount: 5000,
      budgetCurrency: 'SAR',
    })
    const draft = buildPlanningDraft({ requirements: req, locale: 'en' })!
    const lines = planningDraftToInsightLines(draft, 'en').join('\n')
    expect(lines).not.toMatch(/"kind"\s*:|"breakdown"\s*:|planning_draft/)
    expect(lines).toMatch(/\d+–\d+|flights|hotels/i)
    expect(lines).toMatch(/departure city unknown|party size unknown/i)
  })
})

describe('Planning Draft — planTurn integration', () => {
  beforeEach(() => resetFeatureRegistry())

  it('attaches honest draft meta (null travelers, ranged breakdown)', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const t1 = await service.planTurn({
      conversationId: 'draft-1',
      messages: [user('I want to travel to Morocco.', 'draft-1')],
    })
    const turn = await service.planTurn({
      conversationId: 'draft-1',
      messages: [
        user('I want to travel to Morocco.', 'draft-1'),
        assistant(t1.reply, t1.memory, 'draft-1'),
        user('Beginning of August. 7 days. Budget 5000 SAR', 'draft-1'),
      ],
    })

    expect(turn.meta.planningDraft).toBeTruthy()
    expect(turn.meta.planningDraft?.destination).toBe('Morocco')
    expect(turn.meta.planningDraft?.travelerCount).toBeNull()
    expect(turn.meta.planningDraft?.breakdown.flights.low).toBeLessThan(
      turn.meta.planningDraft!.breakdown.flights.high,
    )
    expect(turn.meta.planningDraft?.breakdown.flights.reason).toMatch(/departure city unknown/i)
    expect(turn.meta.planningDraft?.missingAssumptions).toContain('traveler count unknown')
    expect(turn.tripPlan).toBeNull()

    expect(turn.reply).toMatch(/Agadir|Marrakech/i)
    expect(turn.reply).toMatch(/\d+–\d+|departure city unknown|party size unknown/i)
    expect(turn.reply).not.toMatch(/"kind"\s*:\s*"planning_draft"/)
    expect(turn.reply).toMatch(/beach|city|relax|which interests|direction/i)
  })

  it('uses draft ranking so Agadir is preferred over Marrakech on 5000 SAR / 7 nights August', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const turn = await service.planTurn({
      conversationId: 'draft-rank',
      messages: [
        user(
          'Morocco for 7 days beginning of August, budget 5000 SAR',
          'draft-rank',
        ),
      ],
    })
    expect(turn.meta.planningDraft?.rankedCities[0]).toBe('Agadir')
    expect(turn.meta.planningDraft?.travelerCount).toBeNull()
    expect(turn.reply).toMatch(/Agadir/i)
    expect(turn.reply).toMatch(/Marrakech/i)
  })
})
