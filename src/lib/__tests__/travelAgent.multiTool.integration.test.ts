import { describe, it, expect } from 'vitest'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import type { ChatMessage } from '../chat/chatTypes'
import { COMPLETE_JAPAN_5D } from './agentTestFixtures'

function user(content: string): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 7)}`,
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

describe('multi-tool execution integration', () => {
  it('for complete Japan intake: selects tools, executes mocks, merges one TripPlan', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
    })

    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_JAPAN_5D)],
    })

    expect(turn.memory.missingFields).toEqual([])
    expect(turn.tripPlan).toBeTruthy()
    expect(turn.tripPlan?.destinations).toContain('Japan')
    expect(turn.tripPlan?.durationDays).toBe(5)
    expect(turn.tripPlan?.startDate).toMatch(/-04-15$/)

    expect(turn.toolBatch).toBeTruthy()
    expect(turn.toolBatch!.selected).toEqual(expect.arrayContaining([
      'weather',
      'attractions',
      'flights',
      'hotels',
      'maps',
      'visa',
      'transportation',
    ]))
    expect(turn.toolBatch!.okCount).toBeGreaterThanOrEqual(5)
    expect(turn.meta.toolResults?.length).toBeGreaterThan(0)

    expect(turn.tripPlan!.transportation.some((t) => t.mode === 'flight')).toBe(true)
    expect(turn.tripPlan!.accommodations.length).toBeGreaterThan(0)
    expect(turn.tripPlan!.notes.some((n) => /weather|Visa|Merged|طقس|تأشيرة/i.test(n))).toBe(true)
    expect(turn.reply).toMatch(/Japan|اليابان|Daily itinerary|برنامج|Hotels|الفنادق|Summary|الملخص/)
  })
})
