import { describe, it, expect } from 'vitest'
import {
  applyIntelligentDecisions,
  detectTripConflicts,
  scoreFlightCandidate,
  scoreHotelCandidate,
} from '../agent/decision'
import { buildTripPlan } from '../agent/buildItinerary'
import { emptyRequirements } from '../agent/types'
import { extractFromUserText } from '../agent/extractRequirements'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import { COMPLETE_JAPAN_5D } from './agentTestFixtures'
import type { ChatMessage } from '../chat/chatTypes'
import type { AgentToolResult } from '../agent/tools/types'

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

describe('Phase R Intelligent Decision Engine', () => {
  it('prefers nonstop flights and central highly-rated hotels', () => {
    const cheapLong = scoreFlightCandidate({
      airline: 'Stop Air',
      from: 'RUH',
      to: 'HND',
      stops: 2,
      price: 500,
      durationHours: 22,
    }, 0, 3000)
    const direct = scoreFlightCandidate({
      airline: 'Direct Air',
      from: 'RUH',
      to: 'HND',
      stops: 0,
      price: 720,
      durationHours: 11,
      rating: 4.5,
    }, 1, 3000)
    expect(direct.score).toBeGreaterThan(cheapLong.score)

    const far = scoreHotelCandidate({
      name: 'Airport Inn',
      area: 'Narita',
      nightly: 90,
      rating: 6,
    }, 0, ['Tokyo', 'Shinjuku'], 150)
    const near = scoreHotelCandidate({
      name: 'Shinjuku Stay',
      area: 'Shinjuku',
      nightly: 140,
      rating: 8.8,
      breakfastIncluded: true,
    }, 1, ['Tokyo', 'Shinjuku'], 150)
    expect(near.score).toBeGreaterThan(far.score)
  })

  it('enriches TripPlan with scores, rationales, and selected winners', () => {
    const plan = buildTripPlan({
      conversationId: 'c1',
      locale: 'en',
      requirements: {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
        durationDays: 5,
        travelers: 2,
        budgetAmount: 3000,
        budgetCurrency: 'USD',
        interests: ['food', 'culture'],
      },
    })

    const tools: AgentToolResult[] = [
      {
        tool: 'flights',
        status: 'ok',
        summary: 'flights',
        data: {
          offers: [
            { airline: 'Slow Air', from: 'RUH', to: 'HND', stops: 2, price: 480, currency: 'USD', durationHours: 20 },
            { airline: 'Fast Air', from: 'RUH', to: 'HND', stops: 0, price: 690, currency: 'USD', durationHours: 11, rating: 4.6 },
          ],
        },
      },
      {
        tool: 'hotels',
        status: 'ok',
        summary: 'hotels',
        data: {
          stays: [
            { name: 'Far Hotel', area: 'Chiba', category: 'hotel', nightly: 80, currency: 'USD', rating: 6 },
            { name: 'Tokyo Central', area: 'Tokyo', category: 'hotel', nightly: 160, currency: 'USD', rating: 9 },
          ],
        },
      },
      {
        tool: 'maps',
        status: 'ok',
        summary: 'maps',
        data: {
          legs: [{ from: 'Tokyo', to: 'Kyoto', mode: 'transit', distanceKm: 450, durationMinutes: 140 }],
        },
      },
    ]

    const decided = applyIntelligentDecisions(plan, tools, plan.requirements)
    expect(decided.decision).toBeTruthy()
    expect(decided.decision?.scores.overall).toBeGreaterThan(0)
    expect(decided.decision?.scores.overall).toBeLessThanOrEqual(100)
    expect(decided.decision?.flight?.whySelected).toMatch(/Fast Air|score/i)
    expect(decided.decision?.flight?.whyAlternativesRejected.length).toBeGreaterThan(0)
    expect(decided.decision?.flight?.confidence).toBeGreaterThan(0)
    expect(decided.flights[0]?.airline).toBe('Fast Air')
    expect(decided.accommodations).toHaveLength(1)
    expect(decided.accommodations[0]?.name).toBe('Tokyo Central')
    expect(decided.decision?.hotel?.whySelected).toMatch(/Tokyo Central/i)
    // Canonical TripPlan fields remain present
    expect(decided.dailyItinerary.length).toBe(5)
    expect(decided.title).toBeTruthy()
  })

  it('detects impossible schedules and weather outdoor conflicts', () => {
    const plan = buildTripPlan({
      conversationId: 'c1',
      locale: 'en',
      requirements: {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan', 'Kyoto', 'Osaka'],
        durationDays: 3,
        budgetAmount: 500,
        budgetCurrency: 'USD',
      },
    })
    const crowded = {
      ...plan,
      estimatedBudget: { ...plan.estimatedBudget, amount: 900 },
      dailyItinerary: plan.dailyItinerary.map((day, index) => (
        index === 0
          ? {
            ...day,
            activities: Array.from({ length: 8 }, (_, i) => ({
              time: `${9 + i}:00`,
              title: i % 2 === 0 ? `Outdoor park ${i}` : `Cafe ${i}`,
              description: i % 2 === 0 ? 'outdoor walk' : null,
            })),
            weather: {
              summary: 'rain · 16–20°C',
              condition: 'rain',
              tempHighC: 20,
              tempLowC: 16,
              rainProbability: 0.7,
              advice: 'Prefer indoor activities during rain',
            },
          }
          : day
      )),
    }
    const conflicts = detectTripConflicts(crowded, crowded.requirements)
    expect(conflicts.some((c) => c.code === 'impossible_schedule')).toBe(true)
    expect(conflicts.some((c) => c.code === 'weather_outdoor_conflict')).toBe(true)
    expect(conflicts.some((c) => c.code === 'budget_overrun')).toBe(true)
  })

  it('parses regenerate scopes for flight / hotel / activities', () => {
    expect(extractFromUserText('Regenerate flights only', 'en')).toMatchObject({
      intent: 'regenerate',
      patch: { regenerateScope: 'flight' },
    })
    expect(extractFromUserText('Regenerate the hotel options', 'en')).toMatchObject({
      intent: 'regenerate',
      patch: { regenerateScope: 'hotel' },
    })
    expect(extractFromUserText('Regenerate activities please', 'en')).toMatchObject({
      intent: 'regenerate',
      patch: { regenerateScope: 'activities' },
    })
    expect(extractFromUserText('Regenerate day 2', 'en')).toMatchObject({
      intent: 'regenerate_day',
      patch: { regenerateDay: 2, regenerateScope: 'day' },
    })
  })

  it('integrates into TravelAgentService plan turns with decision enrichment', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
    })
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_JAPAN_5D)],
    })
    expect(turn.tripPlan).toBeTruthy()
    expect(turn.tripPlan?.decision?.scores.overall).toBeGreaterThan(0)
    expect(turn.tripPlan?.decision?.version).toBe(1)
    // Experience Sprint 2 — Conversation Brain authors reply; decision scores stay on the plan.
    expect(turn.reply.length).toBeGreaterThan(20)
    expect(turn.reply.toLowerCase()).not.toMatch(/decision engine/)
    expect(turn.reply).toMatch(/Japan|Tokyo|Kyoto/i)
    expect(turn.meta.spokenText).toBeTruthy()
    // Provider-blind: decision layer never names vendor client classes
    expect(JSON.stringify(turn.meta)).not.toMatch(/AmadeusFlightApiClient|BookingComApiClient|OpenWeatherApiClient/)
  })

  it('supports scoped flight regeneration via service API', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
    })
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_JAPAN_5D)],
    })
    expect(turn.tripPlan).toBeTruthy()
    const beforeHotel = turn.tripPlan!.accommodations[0]?.name
    const regenerated = await service.regenerateScoped({
      conversationId: 'c1',
      memory: turn.memory,
      scope: 'flight',
    })
    expect(regenerated.decision).toBeTruthy()
    expect(regenerated.flights.length).toBeGreaterThan(0)
    // Hotel preserved when regenerating flights only
    expect(regenerated.accommodations[0]?.name).toBe(beforeHotel)
  })
})
