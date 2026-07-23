/**
 * Concierge conversation feel — production spine only.
 * Memory, inference, one question, act when ready, calm consultant voice.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import { extractFromUserText } from '../agent/extractRequirements'
import {
  HARD_CLARIFICATION_FIELDS,
  hasApproximateTravelDates,
  missingClarificationFields,
  inferSoftRequirements,
} from '../agent/clarification'
import { mergeRequirements, missingRequirementFields } from '../agent/memory'
import { emptyRequirements } from '../agent/types'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import { generateLocalConversation } from '../agent/conversationBrain/localConversationModel'
import { buildTravelFacts } from '../agent/conversationBrain/travelFacts'
import { emptyMemory } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'
import { decideConciergeTurn } from '../concierge/turnPolicy'

function user(content: string, conversationId = 'conv-feel'): ChatMessage {
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

function assistantWithMemory(
  memory: ReturnType<typeof emptyMemory>,
  conversationId = 'conv-feel',
): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `a-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    role: 'assistant',
    modality: 'text',
    content: '…',
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

describe('Concierge feel — inference', () => {
  it('infers a concrete weekend window from “next weekend”', () => {
    const result = extractFromUserText('I want to travel next weekend.')
    expect(result.patch.durationDays).toBe(2)
    expect(result.patch.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.patch.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(hasApproximateTravelDates(mergeRequirements(emptyRequirements(), result.patch))).toBe(true)
  })

  it('stores Morocco immediately as destination', () => {
    const result = extractFromUserText('Morocco')
    expect(result.patch.destination).toBe('Morocco')
    expect(result.patch.destinations).toContain('Morocco')
  })
})

describe('Concierge feel — never ask twice', () => {
  beforeEach(() => resetFeatureRegistry())

  it('does not list destination once known', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
    })
    expect(missingClarificationFields(req, { smart: true })).not.toContain('destination')
    expect(missingClarificationFields(req, { smart: true })[0]).toBe('durationDays')
  })

  it('does not re-ask dates when startDate is known', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      startDate: '2026-08-01',
      budgetAmount: 8000,
      budgetCurrency: 'SAR',
    })
    expect(missingClarificationFields(req, { smart: true })).toEqual([])
  })

  it('hard clarification fields exclude travelers (inferred, not interrogated)', () => {
    expect(HARD_CLARIFICATION_FIELDS).toEqual(['destination', 'durationDays', 'budgetAmount'])
    expect(HARD_CLARIFICATION_FIELDS).not.toContain('travelers')
  })
})

describe('Concierge feel — one question + act when ready', () => {
  beforeEach(() => resetFeatureRegistry())

  it('asks only one field at a time from concierge policy', () => {
    const memory = emptyMemory('en')
    memory.missingFields = ['destination', 'durationDays', 'budgetAmount']
    const decision = decideConciergeTurn({
      locale: 'en',
      memory,
      userText: 'Hi',
      intent: 'plan',
      requirements: memory.requirements,
      missingFields: memory.missingFields,
      previous: null,
    })
    expect(decision.askFields).toHaveLength(1)
  })

  it('does not invent travelers; hard slots clear when dest + budget + dates exist', () => {
    const base = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      durationDays: 2,
      startDate: '2026-08-08',
      endDate: '2026-08-09',
      budgetAmount: 5000,
      budgetCurrency: 'SAR',
    })
    const inferred = inferSoftRequirements(base, { locale: 'en' })
    expect(inferred.requirements.travelers).toBeNull()
    expect(inferred.requirements.travelerType).toBeNull()
    expect(missingRequirementFields(inferred.requirements, { smart: true })).toEqual([])
  })

  it('planTurn acts when dest + budget + weekend timing exist — no traveler census', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const turn = await service.planTurn({
      conversationId: 'conv-feel-act',
      messages: [
        user('Plan Morocco next weekend under 8000 SAR', 'conv-feel-act'),
      ],
    })
    expect(turn.memory.missingFields).toEqual([])
    expect(turn.memory.requirements.destination).toBe('Morocco')
    expect(turn.memory.requirements.budgetAmount).toBe(8000)
    expect(turn.memory.requirements.durationDays).toBe(2)
    expect(turn.memory.requirements.startDate).toBeTruthy()
    expect(turn.tripPlan || turn.reply).toBeTruthy()
    expect(turn.reply.toLowerCase()).not.toMatch(/how many people|traveling solo|كم شخص|بتسافر لوحدك/)
  })

  it('never re-asks destination on a follow-up turn', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const prior = emptyMemory('en')
    prior.requirements = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
    })
    prior.missingFields = missingRequirementFields(prior.requirements, { smart: true })
    const turn = await service.planTurn({
      conversationId: 'conv-feel-memory',
      messages: [
        user('Morocco', 'conv-feel-memory'),
        assistantWithMemory(prior, 'conv-feel-memory'),
        user('next weekend, budget 5000 SAR', 'conv-feel-memory'),
      ],
    })
    expect(turn.memory.requirements.destination).toBe('Morocco')
    expect(turn.memory.missingFields).not.toContain('destination')
    expect(turn.reply.toLowerCase()).not.toMatch(/which destination|where are you headed|أي وجهة|وين الوجهة/)
  })
})

describe('Concierge feel — consultant voice', () => {
  it('local model avoids fake enthusiasm stock openers', () => {
    const memory = emptyMemory('en')
    memory.requirements = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      durationDays: 2,
    })
    memory.missingFields = ['budgetAmount']
    const facts = buildTravelFacts({
      memory,
      objective: 'collect_missing',
    })
    const out = generateLocalConversation({
      facts,
      userMessage: 'Morocco for a weekend',
      conversationId: 'voice-1',
    })
    expect(out.displayText.toLowerCase()).not.toMatch(/\b(great|excellent|wonderful|perfect|lovely)\b/)
    expect(out.displayText).toMatch(/Understood|I have|Morocco/i)
    expect((out.displayText.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1)
  })
})
