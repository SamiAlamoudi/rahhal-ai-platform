import { describe, expect, it, vi } from 'vitest'
import { runConversationBrain, stripMarkdownForSpeech } from '../agent/conversationBrain/conversationBrain'
import type { TravelFacts } from '../agent/conversationBrain/travelFacts'
import type { ChatMessage } from '../chat/chatTypes'
import type { AgentLlmProvider, ConversationLlmResponse } from '../agent/llm/types'

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

const baseFacts = {
  locale: 'ar',
  objective: 'advise',
  known: {
    destination: 'Istanbul',
    destinations: ['Istanbul'],
    durationDays: null,
    travelers: null,
    travelerType: null,
    budgetAmount: null,
    budgetCurrency: null,
    origin: null,
  },
  missingSlots: ['durationDays'],
} as unknown as TravelFacts

function mockRemote(converse: () => Promise<ConversationLlmResponse>): AgentLlmProvider {
  return {
    providerId: 'openai',
    isAvailable: () => true,
    complete: async () => ({ status: 'ok', providerId: 'openai', draft: null }),
    converse: vi.fn(converse),
  }
}

describe('OpenAI owns conversation (remote pass-through)', () => {
  it('stripMarkdownForSpeech only removes chrome', () => {
    expect(stripMarkdownForSpeech('**مرحبا**\n- بند')).toBe('مرحبا بند')
  })

  it('passes remote displayText and spokenText through without polish or local-guard', async () => {
    const modelDisplay =
      'حسنًا، نركز على إسطنبول.\n\nهذا رد فريد من النموذج لا يجب أن يستبدله القالب المحلي.'
    const modelSpoken = 'حسنًا، نركز على إسطنبول. هل تفضلون عطلة قصيرة؟'
    const remotePayload = JSON.stringify({
      displayText: modelDisplay,
      spokenText: modelSpoken,
    })

    const remote = mockRemote(async () => ({
      status: 'ok',
      text: remotePayload,
      providerId: 'openai',
    }))

    const result = await runConversationBrain({
      llms: {
        list: () => ['openai'],
        get: () => remote,
        getActive: () => remote,
      },
      conversationId: 'c1',
      messages: [user('إسطنبول')],
      facts: baseFacts,
    })

    expect(result.providerId).toBe('openai')
    expect(result.providerId).not.toMatch(/local/)
    expect(result.displayText).toBe(modelDisplay)
    expect(result.spokenText).toBe(modelSpoken)
    // Must not swap in local Istanbul duration template.
    expect(result.displayText).toMatch(/فريد من النموذج/)
    expect(result.displayText).not.toMatch(/سأبني الرحلة على إسطنبول/)
  })

  it('does not translate or rewrite English tokens from remote Arabic replies', async () => {
    const modelDisplay = 'Morocco، 7 أيام، SAR 10000 — نص نموذجي خام'
    const remote = mockRemote(async () => ({
      status: 'ok',
      text: JSON.stringify({
        displayText: modelDisplay,
        spokenText: modelDisplay,
      }),
      providerId: 'openai',
    }))

    const result = await runConversationBrain({
      llms: {
        list: () => ['openai'],
        get: () => remote,
        getActive: () => remote,
      },
      conversationId: 'c1',
      messages: [user('المغرب')],
      facts: { ...baseFacts, known: { ...baseFacts.known, destination: 'Morocco' } },
    })

    expect(result.displayText).toBe(modelDisplay)
    expect(result.displayText).toMatch(/Morocco|SAR/)
  })

  it('falls back to local generative model only when remote fails', async () => {
    const remote = mockRemote(async () => ({
      status: 'error',
      text: '',
      providerId: 'openai',
      error: 'network',
    }))

    const result = await runConversationBrain({
      llms: {
        list: () => ['openai'],
        get: () => remote,
        getActive: () => remote,
      },
      conversationId: 'c1',
      messages: [user('إسطنبول')],
      facts: baseFacts,
    })

    expect(result.providerId).toBe('openai+local-fallback')
    expect(result.displayText.length).toBeGreaterThan(10)
  })
})
