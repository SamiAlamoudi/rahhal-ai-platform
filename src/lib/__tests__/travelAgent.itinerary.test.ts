import { describe, it, expect } from 'vitest'
import { applyTripPlanEdits, buildTripPlan } from '../agent/buildItinerary'
import { formatTripPlanReply } from '../agent/formatReply'
import { emptyRequirements } from '../agent/types'

describe('buildTripPlan', () => {
  it('builds structured trip plan with all foundation sections', () => {
    const plan = buildTripPlan({
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

    expect(plan.destinations[0]).toBe('Japan')
    expect(plan.durationDays).toBe(7)
    expect(plan.dailyItinerary).toHaveLength(7)
    expect(plan.activities).toEqual(plan.dailyItinerary)
    expect(plan.transportation.length).toBeGreaterThan(0)
    expect(plan.accommodations.length).toBeGreaterThan(0)
    expect(plan.estimatedCosts.amount).toBe(plan.estimatedBudget.amount)
    expect(plan.interests).toEqual(['food', 'culture'])
    expect(plan.notes.length).toBeGreaterThan(0)

    const markdown = formatTripPlanReply(plan, 'en')
    expect(markdown).toContain('Daily itinerary')
    expect(markdown).toContain('Transportation')
    expect(markdown).toContain('Accommodation recommendations')
    expect(markdown).toContain('Estimated costs')
  })

  it('does not invent traveler count when unset', () => {
    const plan = buildTripPlan({
      conversationId: 'c1',
      locale: 'en',
      requirements: {
        ...emptyRequirements(),
        destination: 'Riyadh',
        destinations: ['Riyadh'],
        durationDays: 2,
        tripPurpose: 'family',
        travelerType: 'family',
      },
    })
    expect(plan.travelers).toBeNull()
    expect(plan.notes.some((n) => /unconfirmed|غير مؤكد/i.test(n))).toBe(true)
  })

  it('regenerates/edits with a new duration', () => {
    const base = buildTripPlan({
      conversationId: 'c1',
      locale: 'ar',
      requirements: {
        ...emptyRequirements(),
        destination: 'Riyadh',
        destinations: ['Riyadh'],
        durationDays: 2,
      },
    })
    const edited = applyTripPlanEdits(base, { durationDays: 4 }, 'ar')
    expect(edited.durationDays).toBe(4)
    expect(edited.dailyItinerary).toHaveLength(4)
    expect(edited.id).not.toBe(base.id)
  })
})
