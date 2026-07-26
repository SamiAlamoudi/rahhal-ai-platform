/**
 * Executive AI Travel Consultant — conversation feel regression.
 * Live spine: planTurn → Conversation Brain (no architecture rewrite).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import { RAHHAL_CONVERSATION_SYSTEM_PROMPT } from '../agent/conversationBrain'
import type { ChatMessage } from '../chat/chatTypes'

function user(content: string, conversationId = 'c-exec'): ChatMessage {
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
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

describe('Executive AI Travel Consultant', () => {
  beforeEach(() => resetFeatureRegistry())

  it('system prompt owns the consultation (not a chatbot)', () => {
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/Executive AI Travel Consultant|experienced human travel advisor/i)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/How can I help you today/)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/Never ask more than ONE|never more than ONE/i)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/never ask for known facts twice|Never re-ask/i)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/VALUE FIRST|Recommend when confidence is high/i)
  })

  it('Japan opener leads with seasonal value — not a bare When?', async () => {
    const service = createTravelAgentService()
    const turn = await service.planTurn({
      conversationId: 'c-japan',
      messages: [user('I want to travel to Japan.', 'c-japan')],
    })
    expect(turn.reply.toLowerCase()).not.toMatch(/^when do you want to travel\??$/)
    expect(turn.reply.toLowerCase()).not.toMatch(/how can i help you today/)
    expect(turn.reply.toLowerCase()).not.toMatch(/next question|please choose|select from/)
    expect((turn.reply.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1)
    // Remembers destination and advances with value or a useful preference.
    expect(turn.meta.memory?.requirements?.destination).toMatch(/Japan/i)
    expect(turn.reply.length).toBeGreaterThan(40)
  })

  it('budget update advances the plan without restarting or robotic inventory phrases', async () => {
    const service = createTravelAgentService()
    const history: ChatMessage[] = [user('أريد السفر إلى المغرب.', 'c-budget')]
    const t1 = await service.planTurn({ conversationId: 'c-budget', messages: history })
    history.push({
      ...user('a1', 'c-budget'),
      id: 'a1',
      role: 'assistant',
      content: t1.reply,
      providerMeta: t1.meta as unknown as Record<string, unknown>,
    })
    history.push(user('ميزانيتي حوالي 12000 ريال.', 'c-budget'))
    const t2 = await service.planTurn({ conversationId: 'c-budget', messages: history })

    expect(t2.meta.memory?.requirements?.destination).toMatch(/Morocco|المغرب/i)
    expect(t2.meta.memory?.requirements?.budgetAmount).toBe(12000)
    expect(t2.reply).not.toContain('عندي')
    expect(t2.reply).not.toMatch(/اختر من التالي|قم بتعبئة|لدينا عرض/)
    expect(t2.reply.toLowerCase()).not.toMatch(/how can i help you today/)
    expect((t2.reply.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1)
  })

  it('unsure traveler gets a calm step-by-step continuation', async () => {
    const service = createTravelAgentService()
    const history: ChatMessage[] = [user('I want a trip somewhere nice.', 'c-unsure')]
    const t1 = await service.planTurn({ conversationId: 'c-unsure', messages: history })
    history.push({
      ...user('a1', 'c-unsure'),
      id: 'a1',
      role: 'assistant',
      content: t1.reply,
      providerMeta: t1.meta as unknown as Record<string, unknown>,
    })
    history.push(user("I don't know.", 'c-unsure'))
    const t2 = await service.planTurn({ conversationId: 'c-unsure', messages: history })
    expect(t2.reply.toLowerCase()).not.toMatch(/how can i help you today|next question/)
    expect(t2.reply.length).toBeGreaterThan(20)
    expect((t2.reply.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1)
  })
})
