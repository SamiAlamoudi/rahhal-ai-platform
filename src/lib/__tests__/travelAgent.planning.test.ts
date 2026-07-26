import { describe, it, expect } from 'vitest'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import { extractFromUserText } from '../agent/extractRequirements'
import { buildTripPlan, regenerateTripDay } from '../agent/buildItinerary'
import { emptyRequirements } from '../agent/types'
import { COMPLETE_JAPAN_5D } from './agentTestFixtures'
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

describe('Phase L intelligent trip planning', () => {
  it('asks for city first instead of generating for destination-only Japan', async () => {
    const service = createTravelAgentService({ tools: createMockAgentToolRegistry() })
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user('I want to travel to Japan.')],
    })
    expect(turn.tripPlan).toBeNull()
    expect(turn.memory.phase).toBe('collecting')
    expect(turn.meta.tripState?.primaryMissing).toBe('destinationCity')
    expect(turn.reply.toLowerCase()).toMatch(/tokyo|kyoto|osaka|city|مدينة/)
    expect(turn.reply.toLowerCase()).toMatch(/japan|اليابان/)
  })

  it('remembers answers across intake turns then generates a full trip plan', async () => {
    const service = createTravelAgentService({ tools: createMockAgentToolRegistry() })
    const history: ChatMessage[] = [user('I want to travel to Japan.')]
    const t1 = await service.planTurn({ conversationId: 'c1', messages: history })
    history.push({
      ...user('a1'),
      id: 'a1',
      role: 'assistant',
      content: t1.reply,
      providerMeta: t1.meta as unknown as Record<string, unknown>,
    })

    history.push(user('Tokyo'))
    const tCity = await service.planTurn({ conversationId: 'c1', messages: history })
    expect(tCity.tripPlan).toBeNull()
    expect(tCity.meta.tripState?.destinationCity).toBe('Tokyo')
    history.push({
      ...user('a-city'),
      id: 'a-city',
      role: 'assistant',
      content: tCity.reply,
      providerMeta: tCity.meta as unknown as Record<string, unknown>,
    })

    history.push(user('5 days next April'))
    const t2 = await service.planTurn({ conversationId: 'c1', messages: history })
    expect(t2.tripPlan).toBeNull()
    expect(t2.memory.requirements.durationDays).toBe(5)
    expect(t2.memory.missingFields[0]).toBe('budgetAmount')
    history.push({
      ...user('a2'),
      id: 'a2',
      role: 'assistant',
      content: t2.reply,
      providerMeta: t2.meta as unknown as Record<string, unknown>,
    })

    history.push(user(
      'Budget under $3000, 2 travelers couple, food and culture, mild weather, mid-range style, central hotel, full package',
    ))
    const t3 = await service.planTurn({ conversationId: 'c1', messages: history })
    expect(t3.memory.missingFields).toEqual([])
    expect(t3.tripPlan).toBeTruthy()
    expect(t3.tripPlan?.summary).toBeTruthy()
    expect(t3.tripPlan?.dailyItinerary.length).toBe(5)
    expect(t3.tripPlan?.flights.length).toBeGreaterThan(0)
    expect(t3.tripPlan?.accommodations.length).toBeGreaterThan(0)
    expect(t3.tripPlan?.attractions.length).toBeGreaterThan(0)
    expect(t3.tripPlan?.weatherNotes.length).toBeGreaterThan(0)
    expect(t3.tripPlan?.visaNotes.length).toBeGreaterThan(0)
    expect(t3.tripPlan?.travelTips.length).toBeGreaterThan(0)
    expect(t3.tripPlan?.packingSuggestions.length).toBeGreaterThan(0)
    expect(t3.tripPlan?.estimatedBudget.breakdown.length).toBeGreaterThan(0)
    expect(t3.reply).toMatch(/Summary|الملخص|Daily itinerary|برنامج|Budget breakdown|تفصيل الميزانية/)
  })

  it('completes from one rich intake message', async () => {
    const service = createTravelAgentService({ tools: createMockAgentToolRegistry() })
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_JAPAN_5D)],
    })
    expect(turn.memory.missingFields).toEqual([])
    expect(turn.tripPlan?.destinations.some((d) => /Tokyo|Japan/i.test(d))).toBe(true)
    expect(turn.tripPlan?.requirements.packageScope).toBe('full_package')
    expect(turn.tripPlan?.requirements.budgetStyle).toBe('midrange')
  })

  it('regenerates a single day while keeping memory', async () => {
    const service = createTravelAgentService({ tools: createMockAgentToolRegistry() })
    const planned = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_JAPAN_5D)],
    })
    expect(planned.tripPlan).toBeTruthy()
    const assistant: ChatMessage = {
      ...user('a'),
      id: 'a1',
      role: 'assistant',
      content: planned.reply,
      providerMeta: planned.meta as unknown as Record<string, unknown>,
    }
    const dayTurn = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_JAPAN_5D), assistant, user('Regenerate day 2')],
    })
    expect(dayTurn.tripPlan?.dailyItinerary.find((d) => d.day === 2)?.title).toMatch(/refreshed|محدّث/)
    expect(dayTurn.tripPlan?.durationDays).toBe(5)
    expect(dayTurn.memory.requirements.destination).toMatch(/Tokyo|Japan/)
  })

  it('edits budget destination dates and travelers through chat', async () => {
    const service = createTravelAgentService({ tools: createMockAgentToolRegistry() })
    const planned = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_JAPAN_5D)],
    })
    const assistant: ChatMessage = {
      ...user('a'),
      id: 'a1',
      role: 'assistant',
      content: planned.reply,
      providerMeta: planned.meta as unknown as Record<string, unknown>,
    }
    const edited = await service.planTurn({
      conversationId: 'c1',
      messages: [
        user(COMPLETE_JAPAN_5D),
        assistant,
        user('Edit: destination Bali, duration 6 days, budget under $2800, 3 travelers family'),
      ],
    })
    expect(edited.tripPlan?.destinations).toContain('Bali')
    expect(edited.tripPlan?.durationDays).toBe(6)
    expect(edited.tripPlan?.travelers).toBe(3)
    expect(edited.tripPlan?.requirements.budgetAmount).toBe(2800)
  })

  it('parses intake style fields from natural language', () => {
    const result = extractFromUserText(
      'mild weather, luxury style, boutique hotel, flights only, flexible budget, surprise me',
    )
    expect(result.patch.weatherPreference).toBe('mild')
    expect(result.patch.budgetStyle).toBe('luxury')
    expect(result.patch.hotelPreference).toBe('boutique')
    expect(result.patch.packageScope).toBe('flights_only')
    expect(result.patch.budgetFlexible).toBe(true)
    expect(result.patch.interests).toContain('any')
  })

  it('regenerateTripDay helper replaces one day', () => {
    const base = buildTripPlan({
      conversationId: 'c1',
      locale: 'en',
      requirements: {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
        durationDays: 4,
        travelers: 2,
        travelerType: 'couple',
        budgetAmount: 2000,
        budgetCurrency: 'USD',
        budgetStyle: 'midrange',
        hotelPreference: 'central',
        packageScope: 'full_package',
        weatherPreference: 'mild',
        interests: ['food'],
      },
    })
    const next = regenerateTripDay(base, 3, 'en', 'seed-day-3')
    expect(next.dailyItinerary).toHaveLength(4)
    expect(next.dailyItinerary.find((d) => d.day === 3)?.title).toMatch(/refreshed/)
    expect(next.dailyItinerary.find((d) => d.day === 1)?.title).toBe(
      base.dailyItinerary.find((d) => d.day === 1)?.title,
    )
  })
})
