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

describe('aggregation + travel agent integration', () => {
  it('keeps TripPlan API while tools aggregate multiple mock providers', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
    })

    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_JAPAN_5D)],
    })

    expect(turn.tripPlan).toBeTruthy()
    expect(turn.tripPlan?.destinations).toContain('Japan')
    expect(turn.tripPlan?.durationDays).toBe(5)
    expect(turn.tripPlan?.transportation.some((t) => t.mode === 'flight')).toBe(true)
    expect(turn.tripPlan?.accommodations.length).toBeGreaterThan(0)

    const flightTool = turn.toolBatch?.results.find((r) => r.tool === 'flights')
    expect(flightTool?.status).toBe('ok')
    const flightData = flightTool?.data as {
      offers?: unknown[]
      aggregation?: { providersSucceeded?: number; providersQueried?: number }
    }
    // Flights/hotels use priority_fallback (live provider → mocks).
    expect(flightData.aggregation?.providersQueried).toBeGreaterThanOrEqual(1)
    expect(flightData.aggregation?.providersSucceeded).toBeGreaterThanOrEqual(1)
    expect((flightData.offers ?? []).length).toBeGreaterThan(0)

    const hotelTool = turn.toolBatch?.results.find((r) => r.tool === 'hotels')
    const hotelData = hotelTool?.data as {
      stays?: unknown[]
      aggregation?: { providersSucceeded?: number; providersQueried?: number }
    }
    expect(hotelData.aggregation?.providersQueried).toBeGreaterThanOrEqual(1)
    expect(hotelData.aggregation?.providersSucceeded).toBeGreaterThanOrEqual(1)
    expect((hotelData.stays ?? []).length).toBeGreaterThan(0)
  })
})
