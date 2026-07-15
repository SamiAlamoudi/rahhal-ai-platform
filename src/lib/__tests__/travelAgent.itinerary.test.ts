import { describe, it, expect } from 'vitest'
import { applyItineraryEdits, buildTravelItinerary } from '../agent/buildItinerary'
import { formatItineraryReply } from '../agent/formatReply'
import { emptyRequirements } from '../agent/types'

describe('buildTravelItinerary', () => {
  it('builds structured itinerary with all required sections', () => {
    const itinerary = buildTravelItinerary({
      conversationId: 'c1',
      locale: 'en',
      requirements: {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
        durationDays: 7,
        travelers: 2,
        travelerType: 'couple',
        budgetAmount: 3000,
        budgetCurrency: 'USD',
        interests: ['food', 'culture'],
      },
    })

    expect(itinerary.destinations[0]).toBe('Japan')
    expect(itinerary.durationDays).toBe(7)
    expect(itinerary.activities).toHaveLength(7)
    expect(itinerary.transportation.length).toBeGreaterThan(0)
    expect(itinerary.estimatedBudget.amount).toBeGreaterThan(0)
    expect(itinerary.notes.length).toBeGreaterThan(0)

    const markdown = formatItineraryReply(itinerary, 'en')
    expect(markdown).toContain('Day-by-day')
    expect(markdown).toContain('Transportation')
    expect(markdown).toContain('Estimated budget')
  })

  it('regenerates/edits with a new duration', () => {
    const base = buildTravelItinerary({
      conversationId: 'c1',
      locale: 'ar',
      requirements: {
        ...emptyRequirements(),
        destination: 'Riyadh',
        destinations: ['Riyadh'],
        durationDays: 2,
      },
    })
    const edited = applyItineraryEdits(base, { durationDays: 4 }, 'ar')
    expect(edited.durationDays).toBe(4)
    expect(edited.activities).toHaveLength(4)
    expect(edited.id).not.toBe(base.id)
  })
})
