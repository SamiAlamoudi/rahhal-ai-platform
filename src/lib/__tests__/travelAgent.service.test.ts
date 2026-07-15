import { describe, it, expect, vi } from 'vitest'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'

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

describe('travelAgentService orchestration', () => {
  it('asks follow-up instead of guessing duration for honeymoon Bali', async () => {
    const service = createTravelAgentService()
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user('Honeymoon in Bali.')],
    })
    expect(turn.memory.missingFields).toContain('durationDays')
    expect(turn.tripPlan).toBeNull()
    expect(turn.reply.toLowerCase()).toMatch(/day|مدة|duration/)
    expect(turn.meta.version).toBe(2)
  })

  it('builds a business London plan once duration is known', async () => {
    const service = createTravelAgentService()
    const first = await service.planTurn({
      conversationId: 'c1',
      messages: [user('Business trip to London.')],
    })
    const assistant: ChatMessage = {
      ...user('assistant'),
      id: 'a1',
      role: 'assistant',
      content: first.reply,
      providerMeta: first.meta as unknown as Record<string, unknown>,
    }
    const second = await service.planTurn({
      conversationId: 'c1',
      messages: [user('Business trip to London.'), assistant, user('4 days')],
    })
    expect(second.tripPlan?.destinations).toContain('London')
    expect(second.tripPlan?.durationDays).toBe(4)
    expect(second.tripPlan?.travelerType).toBe('business')
    expect(second.tripPlan?.accommodations.length).toBeGreaterThan(0)
    expect(second.reply).toMatch(/Accommodation|الإقامة|Daily itinerary|برنامج/)
  })

  it('saves through orchestration using injected savePlan hook', async () => {
    const savePlan = vi.fn(async () => ({ title: 'Saved' }))
    const service = createTravelAgentService({ savePlan })
    const planned = await service.planTurn({
      conversationId: 'c1',
      messages: [user('Weekend in Riyadh')],
    })
    expect(planned.tripPlan).toBeTruthy()
    const assistant: ChatMessage = {
      ...user('assistant'),
      id: 'a1',
      role: 'assistant',
      content: planned.reply,
      providerMeta: planned.meta as unknown as Record<string, unknown>,
    }
    const ack = await service.planTurn({
      conversationId: 'c1',
      messages: [user('Weekend in Riyadh'), assistant, user('Save the plan')],
    })
    expect(savePlan).toHaveBeenCalled()
    expect(ack.reply).toMatch(/Saved|حفظ/)
  })
})
