import { describe, expect, it, vi } from 'vitest'
import { runConversationBrain } from '../agent/conversationBrain/conversationBrain'
import { buildTravelFacts } from '../agent/conversationBrain/travelFacts'
import {
  hasConfirmedHardFacts,
  isGreetingOnly,
  replyInventedTravelFacts,
} from '../agent/conversationBrain/greetingGuard'
import type { ChatMessage } from '../chat/chatTypes'
import type { AgentLlmProvider, ConversationLlmResponse } from '../agent/llm/types'
import { emptyMemory, emptyRequirements } from '../agent/types'

function user(content: string): ChatMessage {
  return {
    id: 'u1',
    conversationId: 'c1',
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

function mockRemote(text: string): AgentLlmProvider {
  return {
    providerId: 'openai',
    isAvailable: () => true,
    complete: async () => ({ status: 'ok', providerId: 'openai', draft: null }),
    converse: vi.fn(async (): Promise<ConversationLlmResponse> => ({
      status: 'ok',
      text,
      providerId: 'openai',
    })),
  }
}

describe('greeting clean session — no invented travel facts', () => {
  it('detects greeting-only Arabic salam', () => {
    expect(isGreetingOnly('سلام عليكم')).toBe(true)
    expect(isGreetingOnly('السلام عليكم')).toBe(true)
    expect(isGreetingOnly('أبغى أسافر لإسطنبول')).toBe(false)
  })

  it('flags invented budget / travelers / destination in replies', () => {
    const bad =
      'وعليكم السلام، نقدر نجهز رحلة لشخصين بميزانية 10000 دولار لإسطنبول.'
    expect(replyInventedTravelFacts(bad)).toEqual(
      expect.arrayContaining(['budget', 'travelers', 'destination']),
    )
    expect(replyInventedTravelFacts('وعليكم السلام، حياك الله. وين حاب تسافر؟')).toEqual([])
  })

  it('empty known facts are not confirmed hard facts', () => {
    expect(hasConfirmedHardFacts(emptyRequirements())).toBe(false)
  })

  it('سلام عليكم → brief greeting + one neutral question; blocks invented trip details', async () => {
    const hallucinated =
      'وعليكم السلام! جاهزين نخطط رحلة لشخصين بميزانية 10000 دولار مع إقامة مريحة.'
    const remote = mockRemote(hallucinated)
    const memory = emptyMemory('ar')
    const facts = buildTravelFacts({
      memory,
      objective: 'greet_or_continue',
      missingSlots: ['destination', 'durationDays', 'budgetAmount', 'travelers'],
    })

    const result = await runConversationBrain({
      llms: {
        list: () => ['openai'],
        get: () => remote,
        getActive: () => remote,
      },
      conversationId: 'fresh-1',
      messages: [user('سلام عليكم')],
      facts,
    })

    expect(result.displayText).toMatch(/وعليكم السلام/)
    expect(result.displayText).toMatch(/[؟?]|وين|تسافر|وجه/)
    expect(replyInventedTravelFacts(result.displayText)).toEqual([])
    expect(result.displayText).not.toMatch(/10000|دولار|شخصين|إسطنبول|اسطنبول/)
    expect(result.spokenText).toBe(result.displayText)
  })

  it('passes through a grounded greeting without rewriting', async () => {
    const ok = 'وعليكم السلام، حياك الله. وين حاب تسافر؟'
    const remote = mockRemote(ok)
    const facts = buildTravelFacts({
      memory: emptyMemory('ar'),
      objective: 'greet_or_continue',
      missingSlots: ['destination'],
    })
    const result = await runConversationBrain({
      llms: {
        list: () => ['openai'],
        get: () => remote,
        getActive: () => remote,
      },
      conversationId: 'fresh-2',
      messages: [user('سلام عليكم')],
      facts,
    })
    expect(result.displayText).toBe(ok)
    expect(result.providerId).toBe('openai')
  })
})
