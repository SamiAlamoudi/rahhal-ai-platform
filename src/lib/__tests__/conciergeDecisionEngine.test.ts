/**
 * Concierge Decision Engine — value-first intelligence (not form filling).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  evaluateConciergeValueOpportunity,
  isBroadDestination,
  shouldLeadWithValue,
} from '../concierge/decisionEngine'
import { decideConciergeTurn } from '../concierge/turnPolicy'
import { advanceConciergeState, emptyConciergeState } from '../concierge'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import { emptyMemory, emptyRequirements } from '../agent/types'
import { mergeRequirements } from '../agent/memory'
import type { ChatMessage } from '../chat/chatTypes'

function user(content: string, conversationId = 'conv-intel'): ChatMessage {
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
  conversationId = 'conv-intel',
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

describe('Concierge Decision Engine — unit', () => {
  it('treats Morocco / Japan as broad destinations', () => {
    expect(isBroadDestination('Morocco')).toBe(true)
    expect(isBroadDestination('Japan')).toBe(true)
    expect(isBroadDestination('Tokyo')).toBe(false)
  })

  it('leads with city compares when only Morocco is known', () => {
    const assessment = evaluateConciergeValueOpportunity({
      requirements: mergeRequirements(emptyRequirements(), {
        destination: 'Morocco',
        destinations: ['Morocco'],
      }),
      locale: 'en',
      userText: 'I want to travel to Morocco.',
      previous: null,
    })
    expect(assessment.canProvideValue).toBe(true)
    expect(assessment.mode).toBe('destination_cities')
    expect(assessment.valueBrief.join(' ')).toMatch(/Agadir|Marrakech|Casablanca/)
    expect(assessment.preferenceQuestion).toMatch(/interests you most|which/i)
  })

  it('frames Morocco cities with budget + August timing', () => {
    const assessment = evaluateConciergeValueOpportunity({
      requirements: mergeRequirements(emptyRequirements(), {
        destination: 'Morocco',
        destinations: ['Morocco'],
        budgetAmount: 5000,
        budgetCurrency: 'SAR',
        startDate: '2026-08-01',
      }),
      locale: 'en',
      userText: 'Beginning of August, budget 5000',
      previous: null,
    })
    expect(assessment.mode).toBe('budget_framed_cities')
    expect(assessment.framingNote).toMatch(/5000|August|2026-08/i)
    expect(assessment.valueBrief.some((line) => /Agadir/i.test(line))).toBe(true)
  })

  it('educates on Japan seasons for “next year”', () => {
    const assessment = evaluateConciergeValueOpportunity({
      requirements: mergeRequirements(emptyRequirements(), {
        destination: 'Japan',
        destinations: ['Japan'],
      }),
      locale: 'en',
      userText: 'I want Japan next year.',
      previous: null,
    })
    expect(assessment.mode).toBe('season_guidance')
    expect(assessment.valueBrief.join(' ')).toMatch(/Cherry blossom|Autumn|Winter/i)
    expect(assessment.preferenceQuestion).toMatch(/season/i)
  })
})

describe('Concierge Decision Engine — turn policy', () => {
  it('does not ask duration/budget when Morocco alone can already be advised', () => {
    const memory = emptyMemory('en')
    memory.requirements = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
    })
    memory.missingFields = ['durationDays', 'budgetAmount']
    const previous = advanceConciergeState({
      previous: emptyConciergeState(),
      phase: 'discovery',
      lastAction: 'greet',
    })
    const decision = decideConciergeTurn({
      locale: 'en',
      memory,
      userText: 'I want to travel to Morocco.',
      intent: 'answer',
      requirements: memory.requirements,
      missingFields: memory.missingFields,
      previous,
    })
    expect(['propose_options', 'advise']).toContain(decision.action)
    expect(decision.askFields).toEqual([])
    expect(decision.shouldExecuteAgent).toBe(false)
    expect(decision.valueBrief?.join(' ')).toMatch(/Agadir|Marrakech/)
    expect(decision.rationale).toMatch(/Decision Engine|cities|value/i)
  })

  it('still greets with a discovery cue when nothing is known', () => {
    const memory = emptyMemory('en')
    memory.missingFields = ['destination', 'durationDays', 'budgetAmount']
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
    expect(decision.askFields).toEqual(['destination'])
  })
})

describe('Concierge Decision Engine — live planTurn feel', () => {
  beforeEach(() => resetFeatureRegistry())

  it('Morocco alone → recommends cities, does not only ask When/Budget/Days', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const turn = await service.planTurn({
      conversationId: 'intel-morocco',
      messages: [user('I want to travel to Morocco.', 'intel-morocco')],
    })
    expect(turn.memory.requirements.destination).toBe('Morocco')
    expect(turn.reply).toMatch(/Agadir|Marrakech|Casablanca/i)
    expect(turn.reply.toLowerCase()).not.toMatch(/^(understood:[^.]*\.\s*)?(when\?|budget\?|how many)/i)
    expect(turn.reply).not.toMatch(/\bHow many (days|travelers|people)\b/i)
    expect(turn.reply).toMatch(/which|beach|city|interests you|direction/i)
  })

  it('Morocco + August + 5000 → value with cities, not duration census', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const t1 = await service.planTurn({
      conversationId: 'intel-combo',
      messages: [user('I want to travel to Morocco.', 'intel-combo')],
    })
    const t2 = await service.planTurn({
      conversationId: 'intel-combo',
      messages: [
        user('I want to travel to Morocco.', 'intel-combo'),
        assistant(t1.reply, t1.memory, 'intel-combo'),
        user('Beginning of August. Budget 5000', 'intel-combo'),
      ],
    })
    expect(t2.memory.requirements.destination).toBe('Morocco')
    expect(t2.memory.requirements.budgetAmount).toBe(5000)
    expect(t2.reply).toMatch(/Agadir|Marrakech|Casablanca/i)
    expect(t2.reply).toMatch(/5000|August|2026-08/i)
    expect(t2.reply).not.toMatch(/\bHow many days\b|\bHow many travelers\b|\bBudget\?\b/i)
  })

  it('Japan next year → season guidance with context', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const turn = await service.planTurn({
      conversationId: 'intel-japan',
      messages: [user('I want Japan next year.', 'intel-japan')],
    })
    expect(turn.memory.requirements.destination).toBe('Japan')
    expect(turn.reply).toMatch(/season|cherry blossom|autumn|spring|winter/i)
    expect(turn.reply).not.toMatch(/\bBudget\?\b|\bHow many days\b/i)
  })
})

describe('shouldLeadWithValue', () => {
  it('leads with value whenever destination cities are available', () => {
    const result = shouldLeadWithValue({
      requirements: mergeRequirements(emptyRequirements(), {
        destination: 'Morocco',
        destinations: ['Morocco'],
      }),
      locale: 'en',
      userText: 'Morocco',
      previous: null,
      hardMissing: 2,
    })
    expect(result.leadWithValue).toBe(true)
  })
})
