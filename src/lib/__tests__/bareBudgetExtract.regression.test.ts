/**
 * Regression: bare / numeric budget replies must populate budgetAmount.
 * Forensic root cause: matchBudget() returned null for "5000" → patch={} → merge left null.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import { extractFromUserText } from '../agent/extractRequirements'
import { inferSoftRequirements } from '../agent/clarification'
import { mergeRequirements } from '../agent/memory'
import { emptyRequirements } from '../agent/types'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import { emptyMemory } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'

function user(content: string, conversationId = 'conv-budget'): ChatMessage {
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
  conversationId = 'conv-budget',
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

describe('bare budget extract — unit cases', () => {
  it.each([
    ['5000', 5000],
    ['٥٠٠٠', 5000],
    ['3000', 3000],
    ['10000', 10000],
    ['12,000', 12000],
    ['12000', 12000],
    ['2500.50', 2500.5],
  ])('extracts bare numeric budget from %s', (text, amount) => {
    const result = extractFromUserText(text)
    expect(result.patch.budgetAmount).toBe(amount)
  })
})

describe('Conversation A — Morocco then bare 5000', () => {
  beforeEach(() => resetFeatureRegistry())

  it('keeps destination and persists budgetAmount=5000', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })

    const turn1 = await service.planTurn({
      conversationId: 'conv-a',
      messages: [user('Morocco', 'conv-a')],
    })
    expect(turn1.memory.requirements.destination).toBe('Morocco')
    expect(turn1.memory.requirements.budgetAmount).toBeNull()

    // Forensic mid-path: extract → merge must set budget before brain runs.
    const bare = extractFromUserText('5000')
    expect(bare.patch).toMatchObject({ budgetAmount: 5000 })
    const merged = mergeRequirements(turn1.memory.requirements, bare.patch)
    expect(merged.destination).toBe('Morocco')
    expect(merged.budgetAmount).toBe(5000)

    const turn2 = await service.planTurn({
      conversationId: 'conv-a',
      messages: [
        user('Morocco', 'conv-a'),
        assistant('When would you like to travel?', turn1.memory, 'conv-a'),
        user('5000', 'conv-a'),
      ],
    })
    expect(turn2.memory.requirements.destination).toBe('Morocco')
    expect(turn2.memory.requirements.budgetAmount).toBe(5000)
  })
})

describe('Conversation B — Japan then Budget? then 7000', () => {
  beforeEach(() => resetFeatureRegistry())

  it('persists budgetAmount=7000 after budget question', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })

    const turn1 = await service.planTurn({
      conversationId: 'conv-b',
      messages: [user('Japan', 'conv-b')],
    })
    expect(turn1.memory.requirements.destination).toBe('Japan')

    const turn2 = await service.planTurn({
      conversationId: 'conv-b',
      messages: [
        user('Japan', 'conv-b'),
        assistant('What is your budget?', turn1.memory, 'conv-b'),
        user('7000', 'conv-b'),
      ],
    })
    expect(turn2.memory.requirements.budgetAmount).toBe(7000)
    expect(turn2.memory.requirements.destination).toBe('Japan')
  })
})

describe('Conversation C — Budget is 4500', () => {
  it('extracts budgetAmount=4500', () => {
    const result = extractFromUserText('Budget is 4500')
    expect(result.patch.budgetAmount).toBe(4500)
  })
})

describe('Conversation D — ميزانيتي ٥٠٠٠', () => {
  it('extracts budgetAmount=5000 from Arabic digits', () => {
    const result = extractFromUserText('ميزانيتي ٥٠٠٠')
    expect(result.patch.budgetAmount).toBe(5000)
  })
})

describe('Conversation E — 5000 ريال', () => {
  it('extracts budgetAmount=5000 with SAR', () => {
    const result = extractFromUserText('5000 ريال')
    expect(result.patch.budgetAmount).toBe(5000)
    expect(result.patch.budgetCurrency).toBe('SAR')
  })
})

describe('inferSoftRequirements — no form filling', () => {
  it('leaves travelers/hotel/style/purpose/interests null when unset', () => {
    const base = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      budgetAmount: 5000,
    })
    const result = inferSoftRequirements(base, { locale: 'en' })
    expect(result.requirements.travelers).toBeNull()
    expect(result.requirements.travelerType).toBeNull()
    expect(result.requirements.hotelPreference).toBeNull()
    expect(result.requirements.budgetStyle).toBeNull()
    expect(result.requirements.tripPurpose).toBeNull()
    expect(result.requirements.packageScope).toBeNull()
    expect(result.requirements.weatherPreference).toBeNull()
    expect(result.requirements.interests).toEqual([])
  })
})
