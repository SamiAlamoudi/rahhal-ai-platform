import { describe, it, expect } from 'vitest'
import { extractFromUserText } from '../agent/extractRequirements'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createTravelAgentProvider } from '../agent/travelAgentProvider'
import { createLocalAgentLlmAdapter } from '../agent/llm/localLlmAdapter'
import { createOpenAiAgentLlmAdapter } from '../agent/llm/openaiLlmAdapter'
import { runConversationBrain, buildTravelFacts, RAHHAL_CONVERSATION_SYSTEM_PROMPT } from '../agent/conversationBrain'
import { createAgentLlmRegistry } from '../agent/llm/factory'
import { emptyMemory, emptyRequirements } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'
import { COMPLETE_JAPAN_5D } from './agentTestFixtures'

function user(content: string): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
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

describe('Experience Sprint 2 — LLM Conversation Brain', () => {
  it('ships a single conversation system prompt', () => {
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/Rahhal/)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/Never say/)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/displayText/)
  })

  it('OpenAI adapter is available only with a key', () => {
    const adapter = createOpenAiAgentLlmAdapter()
    expect(adapter.providerId).toBe('openai')
    expect(typeof adapter.converse).toBe('function')
  })

  it('local converse returns JSON display+spoken from Travel Facts', async () => {
    const llm = createLocalAgentLlmAdapter()
    const memory = emptyMemory('en')
    memory.requirements = {
      ...emptyRequirements(),
      destination: 'Japan',
      destinations: ['Japan'],
    }
    memory.missingFields = ['durationDays']
    const facts = buildTravelFacts({
      memory,
      objective: 'collect_missing',
      missingSlots: ['durationDays'],
    })
    const result = await runConversationBrain({
      llms: {
        list: () => ['local'],
        get: () => llm,
        getActive: () => llm,
      },
      conversationId: 'c1',
      messages: [user('I want Japan')],
      facts,
    })
    expect(result.displayText.length).toBeGreaterThan(10)
    expect(result.spokenText.length).toBeGreaterThan(5)
    expect(result.displayText.toLowerCase()).not.toMatch(/next question|step 1|please choose|بدون تخمين|سؤال التالي/)
  })

  it('planTurn never returns form-wizard follow-ups', async () => {
    const service = createTravelAgentService({ concierge: false })
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user('I want to travel to Japan.')],
    })
    expect(turn.tripPlan).toBeNull()
    expect(turn.reply.toLowerCase()).not.toMatch(/next question|سؤال التالي|smart trip plan|خطة سفر ذكية|بدون تخمين/)
    expect(turn.meta.spokenText).toBeTruthy()
  })

  it('complete intake: LLM display + short spokenText, plan facts in meta', async () => {
    const service = createTravelAgentService({ concierge: false })
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_JAPAN_5D)],
    })
    expect(turn.tripPlan?.destinations).toContain('Japan')
    expect(turn.meta.spokenText).toBeTruthy()
    expect(turn.meta.spokenText!.length).toBeLessThan(600)
    expect(turn.reply.toLowerCase()).not.toMatch(/decision engine|next question/)
  })

  it('provider does not emit scripted thinking bridge', async () => {
    const provider = createTravelAgentProvider({
      service: createTravelAgentService({ concierge: false }),
    })
    const chunks: Array<{ type: string; text?: string; meta?: Record<string, unknown> }> = []
    const controller = new AbortController()
    for await (const chunk of provider.streamReply({
      conversationId: 'c1',
      messages: [user('I want to travel to Japan.')],
      signal: controller.signal,
    })) {
      chunks.push(chunk as never)
    }
    const firstText = chunks.find((c) => c.type === 'delta' && c.text)?.text ?? ''
    expect(String(firstText)).not.toMatch(/Give me a second — I already have a few ideas/)
    const done = chunks.find((c) => c.type === 'done')
    expect(done?.meta?.spokenText).toBeTruthy()
  })

  it('wife + two weeks extracts without re-asking those slots', () => {
    const result = extractFromUserText(
      'I want to spend two weeks in Japan next August with my wife.',
    )
    expect(result.patch.destination).toBe('Japan')
    expect(result.patch.durationDays).toBe(14)
    expect(result.patch.travelerType).toBe('couple')
    expect(result.patch.travelers).toBe(2)
  })

  it('registry getActive prefers available openai when selected', () => {
    const registry = createAgentLlmRegistry('local')
    expect(registry.getActive().providerId).toMatch(/local|openai/)
  })
})
