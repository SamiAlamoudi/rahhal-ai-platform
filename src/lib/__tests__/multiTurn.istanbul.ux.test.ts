import { describe, it, expect } from 'vitest'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'

function msg(role: 'user' | 'assistant', content: string, meta: Record<string, unknown> = {}): ChatMessage {
  return {
    id: Math.random().toString(36).slice(2),
    conversationId: 'c1',
    role,
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: meta,
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

describe('multi-turn istanbul continuity', () => {
  it('continues after duration then budget without hanging', async () => {
    const service = createTravelAgentService({ concierge: false })
    const t0 = Date.now()
    const a1 = await service.planTurn({
      conversationId: 'c1',
      messages: [msg('user', 'أفكر أسافر إلى إسطنبول')],
    })
    // eslint-disable-next-line no-console
    console.log('t1', Date.now() - t0, a1.memory.requirements.destination, a1.memory.missingFields, a1.reply.slice(0, 100))

    const a2 = await service.planTurn({
      conversationId: 'c1',
      messages: [
        msg('user', 'أفكر أسافر إلى إسطنبول'),
        msg('assistant', a1.reply, a1.meta as never),
        msg('user', 'عطلة قصيرة'),
      ],
    })
    // eslint-disable-next-line no-console
    console.log('t2', Date.now() - t0, a2.memory.requirements.durationDays, a2.memory.missingFields, a2.reply.slice(0, 100))

    const a3 = await service.planTurn({
      conversationId: 'c1',
      messages: [
        msg('user', 'أفكر أسافر إلى إسطنبول'),
        msg('assistant', a1.reply, a1.meta as never),
        msg('user', 'عطلة قصيرة'),
        msg('assistant', a2.reply, a2.meta as never),
        msg('user', 'ميزانية عشرة آلاف ريال لشخصين'),
      ],
    })
    // eslint-disable-next-line no-console
    console.log('t3', Date.now() - t0, {
      duration: a3.memory.requirements.durationDays,
      budget: a3.memory.requirements.budgetAmount,
      travelers: a3.memory.requirements.travelers,
      dest: a3.memory.requirements.destination,
      missing: a3.memory.missingFields,
      hasPlan: Boolean(a3.tripPlan),
      reply: a3.reply.slice(0, 160),
    })
    expect(a3.reply.length).toBeGreaterThan(10)
    expect(a3.memory.requirements.destination).toMatch(/Istanbul|إسطنبول/i)
    expect(Date.now() - t0).toBeLessThan(20_000)
  }, 25_000)
})
