import { describe, it, expect } from 'vitest'
import { buildTripPlan } from '../agent/buildItinerary'
import { mergeToolResultsIntoPlan } from '../agent/tools/mergeToolResults'
import { emptyRequirements } from '../agent/types'
import type { AgentToolResult } from '../agent/tools/types'

describe('mergeToolResultsIntoPlan', () => {
  it('merges flights hotels weather attractions into one plan', () => {
    const base = buildTripPlan({
      conversationId: 'c1',
      locale: 'en',
      requirements: {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
        durationDays: 5,
        travelers: 2,
      },
    })

    const results: AgentToolResult[] = [
      {
        tool: 'flights',
        status: 'ok',
        summary: 'flight',
        data: {
          offers: [{ airline: 'Mock Air', from: 'RUH', to: 'HND', price: 700, currency: 'USD', stops: 1 }],
        },
      },
      {
        tool: 'hotels',
        status: 'ok',
        summary: 'hotels',
        data: {
          stays: [{ name: 'Tokyo Stay', area: 'Tokyo', category: 'hotel', nightly: 150, currency: 'USD' }],
        },
      },
      {
        tool: 'weather',
        status: 'ok',
        summary: 'weather',
        data: { summary: 'spring 16C', averageHighC: 16, season: 'spring' },
      },
      {
        tool: 'attractions',
        status: 'ok',
        summary: 'attractions',
        data: { attractions: [{ title: 'Senso-ji', tag: 'culture' }] },
      },
    ]

    const merged = mergeToolResultsIntoPlan(base, results)
    expect(merged.transportation.some((t) => t.mode === 'flight' && t.estimatedCost === 700)).toBe(true)
    expect(merged.flights.some((f) => f.estimatedCost === 700)).toBe(true)
    expect(merged.accommodations[0]?.name).toBe('Tokyo Stay')
    expect(merged.weatherNotes.some((n) => /Weather|الطقس|spring/i.test(n))).toBe(true)
    expect(merged.attractions.some((a) => a.title === 'Senso-ji')).toBe(true)
    expect(merged.dailyItinerary.some((d) => d.activities.some((a) => a.title === 'Senso-ji'))).toBe(true)
  })
})
