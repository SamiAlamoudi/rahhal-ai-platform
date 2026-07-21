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
  it('keeps TripPlan API while flights/hotels use production search engines', async () => {
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
    expect(flightTool?.meta?.providerId).toBe('flight-search-engine')
    const flightData = flightTool?.data as {
      offers?: unknown[]
      searchEngine?: string
      diagnostics?: { providersUsed?: string[] }
    }
    expect(flightData.searchEngine).toBe('flightSearchEngine')
    expect(flightData.diagnostics?.providersUsed?.length).toBeGreaterThanOrEqual(1)
    expect((flightData.offers ?? []).length).toBeGreaterThan(0)

    const hotelTool = turn.toolBatch?.results.find((r) => r.tool === 'hotels')
    expect(hotelTool?.meta?.providerId).toBe('hotel-search-engine')
    const hotelData = hotelTool?.data as {
      stays?: unknown[]
      searchEngine?: string
      diagnostics?: { providersUsed?: string[] }
    }
    expect(hotelData.searchEngine).toBe('hotelSearchEngine')
    expect(hotelData.diagnostics?.providersUsed?.length).toBeGreaterThanOrEqual(1)
    expect((hotelData.stays ?? []).length).toBeGreaterThan(0)
  })
})
