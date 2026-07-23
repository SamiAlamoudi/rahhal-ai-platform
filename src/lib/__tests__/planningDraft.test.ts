/**
 * Planning Draft — deterministic trip intelligence (not itinerary, not bookings).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  buildPlanningDraft,
  canBuildPlanningDraft,
  planningDraftToInsightLines,
} from '../agent/planningDraft'
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

  it('drafts when destination + budget exist', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      budgetAmount: 5000,
      budgetCurrency: 'SAR',
    })
    expect(canBuildPlanningDraft(req)).toBe(true)
  })
})

describe('Planning Draft — Morocco estimate', () => {
  it('produces ranked cities, breakdown, confidence, and missing assumptions', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      durationDays: 7,
      startDate: '2026-08-01',
      budgetAmount: 5000,
      budgetCurrency: 'SAR',
    })
    const draft = buildPlanningDraft({ requirements: req, locale: 'en' })
    expect(draft).toBeTruthy()
    expect(draft!.kind).toBe('planning_draft')
    expect(draft!.destination).toBe('Morocco')
    expect(draft!.recommendedDurationDays).toBe(7)
    expect(draft!.cities.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Agadir', 'Marrakech', 'Casablanca']),
    )
    expect(draft!.rankedCities[0]).toBeTruthy()
    expect(draft!.breakdown.flights).toBeGreaterThan(0)
    expect(draft!.breakdown.hotels).toBeGreaterThan(0)
    expect(draft!.breakdown.food).toBeGreaterThan(0)
    expect(draft!.breakdown.transportation).toBeGreaterThan(0)
    expect(draft!.breakdown.activities).toBeGreaterThan(0)
    expect(draft!.breakdown.currency).toBe('SAR')
    expect(['low', 'medium', 'high']).toContain(draft!.confidence)
    expect(draft!.missingAssumptions.some((m) => /departure city/i.test(m))).toBe(true)
    expect(draft!.rankingNote).toMatch(/Agadir|Marrakech|Casablanca|budget/i)
    // Agadir should rank ahead of Marrakech on a tight August budget (lower hotels).
    expect(draft!.rankedCities.indexOf('Agadir')).toBeLessThan(
      draft!.rankedCities.indexOf('Marrakech'),
    )
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

  it('insight lines never look like raw JSON keys', () => {
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
    expect(lines).toMatch(/flights|hotels|food/i)
  })
})

describe('Planning Draft — planTurn integration', () => {
  beforeEach(() => resetFeatureRegistry())

  it('attaches draft to meta and phrases planning in the reply (no JSON dump)', async () => {
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
    expect(turn.meta.planningDraft?.breakdown.flights).toBeGreaterThan(0)
    expect(turn.meta.planningDraft?.rankedCities.length).toBeGreaterThanOrEqual(2)
    expect(turn.tripPlan).toBeNull()

    expect(turn.reply).toMatch(/Agadir|Marrakech/i)
    expect(turn.reply).toMatch(/hotel|budget|fit|lower|≈|flights|food/i)
    expect(turn.reply).not.toMatch(/"kind"\s*:\s*"planning_draft"|missingAssumptions/)
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
    expect(turn.reply).toMatch(/Agadir/i)
    expect(turn.reply).toMatch(/Marrakech/i)
  })
})
