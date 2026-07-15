import { describe, it, expect, vi } from 'vitest'
import { createTravelAgentProvider } from '../agent/travelAgentProvider'
import type { ChatMessage } from '../chat/chatTypes'
import { COMPLETE_RIYADH_WEEKEND, INTAKE_AFTER_DESTINATION } from './agentTestFixtures'

function user(content: string): ChatMessage {
  return {
    id: `u-${content.length}`,
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

async function collect(provider: ReturnType<typeof createTravelAgentProvider>, messages: ChatMessage[]) {
  const chunks: Array<{ type: string; text?: string; meta?: Record<string, unknown> }> = []
  for await (const chunk of provider.streamReply({
    conversationId: 'c1',
    messages,
    signal: new AbortController().signal,
  })) {
    chunks.push(chunk)
  }
  const text = chunks.filter((c) => c.type === 'delta').map((c) => c.text ?? '').join('')
  const done = chunks.find((c) => c.type === 'done')
  return { text, meta: done?.meta as Record<string, unknown> | undefined }
}

describe('travelAgentProvider', () => {
  it('asks follow-up when duration is missing', async () => {
    const provider = createTravelAgentProvider()
    const { text, meta } = await collect(provider, [user('Plan a trip to Japan')])
    expect(text.toLowerCase()).toMatch(/day|يوم|duration|مدة|when|متى/)
    expect(meta?.kind).toBe('travel_agent')
    const memory = meta?.memory as { phase?: string; missingFields?: string[] }
    expect(memory.phase).toBe('collecting')
    expect(memory.missingFields).toContain('durationDays')
  })

  it('produces itinerary after memory answers the remaining intake fields', async () => {
    const provider = createTravelAgentProvider()
    const first = await collect(provider, [user('Plan a trip to Japan')])
    const assistant: ChatMessage = {
      ...user('assistant'),
      id: 'a1',
      role: 'assistant',
      content: first.text,
      providerMeta: first.meta ?? {},
    }
    const second = await collect(provider, [
      user('Plan a trip to Japan'),
      assistant,
      user(INTAKE_AFTER_DESTINATION),
    ])
    expect(second.text).toMatch(/Day 1|اليوم 1|Summary|الملخص/)
    expect(second.meta?.version).toBe(2)
    const tripPlan = (second.meta?.tripPlan ?? second.meta?.itinerary) as {
      durationDays?: number
      destinations?: string[]
      accommodations?: unknown[]
    }
    expect(tripPlan.durationDays).toBe(7)
    expect(tripPlan.destinations?.[0]).toBe('Japan')
    expect(tripPlan.accommodations?.length).toBeGreaterThan(0)
  })

  it('saves via injected hook on save intent', async () => {
    const saveItinerary = vi.fn(async () => ({ title: 'Saved trip' }))
    const provider = createTravelAgentProvider({ saveItinerary })
    const planned = await collect(provider, [user(COMPLETE_RIYADH_WEEKEND)])
    const assistant: ChatMessage = {
      ...user('assistant'),
      id: 'a1',
      role: 'assistant',
      content: planned.text,
      providerMeta: planned.meta ?? {},
    }
    const saved = await collect(provider, [
      user(COMPLETE_RIYADH_WEEKEND),
      assistant,
      user('Save the plan'),
    ])
    expect(saveItinerary).toHaveBeenCalled()
    expect(saved.text).toMatch(/Saved|حفظ/)
  })
})
