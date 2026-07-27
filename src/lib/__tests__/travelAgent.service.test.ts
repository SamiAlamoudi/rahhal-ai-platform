import { describe, it, expect, vi } from 'vitest'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'
import { COMPLETE_LONDON_BUSINESS, COMPLETE_RIYADH_WEEKEND } from './agentTestFixtures'

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
    expect(turn.reply.toLowerCase()).toMatch(/day|مدة|duration|when|متى|week|أسبوع|break|عطلة/)
    expect(turn.meta.version).toBe(2)
  })

  it('builds a business London plan once intake is complete', async () => {
    const service = createTravelAgentService()
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_LONDON_BUSINESS)],
    })
    expect(turn.tripPlan?.destinations).toContain('London')
    expect(turn.tripPlan?.durationDays).toBe(4)
    expect(turn.tripPlan?.travelerType).toBe('business')
    expect(turn.tripPlan?.accommodations.length).toBeGreaterThan(0)
    expect(turn.reply).toMatch(/London|stay|outline|plan|فندق|إقامة|تصوّر|Suggested stay|Day one/i)
  })

  it('saves through orchestration using injected savePlan hook', async () => {
    const savePlan = vi.fn(async () => ({ title: 'Saved' }))
    const service = createTravelAgentService({ savePlan })
    const planned = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_RIYADH_WEEKEND)],
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
      messages: [user(COMPLETE_RIYADH_WEEKEND), assistant, user('Save the plan')],
    })
    expect(savePlan).toHaveBeenCalled()
    expect(ack.reply).toMatch(/Saved|حفظ/)
  })
})
