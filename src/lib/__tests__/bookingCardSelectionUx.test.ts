import { describe, expect, it } from 'vitest'
import {
  buildBookingOptionsFromPlan,
  displayProviderLabel,
  formatBookingOptionPrice,
  matchBookingOptionSelection,
  sanitizeTravelerFacingLabel,
} from '../agent/bookingOptionsFromSearch'
import type { TripPlan } from '../agent/types'
import { emptyRequirements } from '../agent/types'

function samplePlan(): TripPlan {
  return {
    id: 'plan-test',
    title: 'Lebanon',
    summary: 'trip',
    locale: 'ar',
    destinations: ['لبنان'],
    startDate: '2026-08-03',
    endDate: '2026-08-10',
    durationDays: 7,
    travelers: 1,
    travelerType: null,
    interests: [],
    dailyItinerary: [],
    activities: [],
    transportation: [],
    accommodations: [
      {
        name: 'Mock Hotel 1',
        area: 'Beirut',
        category: 'hotel',
        fit: 'test',
        estimatedNightly: 0,
        currency: 'SAR',
        provider: 'mock',
        fromProvider: true,
      },
      {
        name: 'Beirut Central Hotel',
        area: 'Beirut',
        category: 'hotel',
        fit: 'test',
        estimatedNightly: 420,
        currency: 'SAR',
        provider: 'mock',
        fromProvider: true,
      },
    ],
    attractions: [],
    flights: [
      {
        id: 'flight-sv-1',
        from: 'RUH',
        to: 'BEY',
        airline: 'Saudia',
        stops: 0,
        estimatedCost: 2400,
        currency: 'SAR',
        notes: null,
        fromProvider: true,
        provider: 'mock',
        departureTime: '2026-08-03T08:00:00Z',
        arrivalTime: '2026-08-03T12:00:00Z',
        durationMinutes: 240,
        cabin: 'economy',
      },
    ],
    weatherNotes: [],
    visaNotes: [],
    travelTips: [],
    packingSuggestions: [],
    estimatedBudget: { amount: 0, currency: 'SAR', breakdown: [] },
    estimatedCosts: { amount: 0, currency: 'SAR', breakdown: [] },
    notes: [],
    conversationId: 'c1',
    requirements: {
      ...emptyRequirements(),
      destination: 'لبنان',
      origin: 'الرياض',
      travelers: 1,
      startDate: '2026-08-03',
      endDate: '2026-08-10',
    },
    updatedAt: new Date().toISOString(),
  }
}

describe('booking card production UX', () => {
  it('never includes hotel cards with price 0', () => {
    const cards = buildBookingOptionsFromPlan(samplePlan())
    const hotels = cards.filter((c) => c.kind === 'hotel')
    expect(hotels.length).toBe(1)
    expect(hotels[0]!.price).toBe(420)
    expect(hotels.every((h) => h.price != null && h.price > 0)).toBe(true)
  })

  it('hides mock provider labels from cards', () => {
    const cards = buildBookingOptionsFromPlan(samplePlan())
    expect(cards.every((c) => c.provider == null || !/mock/i.test(c.provider))).toBe(true)
    expect(displayProviderLabel('mock')).toBeNull()
    expect(displayProviderLabel('amadeus')).toBe('amadeus')
  })

  it('sanitizes Mock branding from traveler-facing labels', () => {
    expect(sanitizeTravelerFacingLabel('Mock Hotel 2')).toMatch(/City Hotel/)
    expect(sanitizeTravelerFacingLabel('MockAir')).toBe('Saudia')
    expect(formatBookingOptionPrice(0, 'SAR', 'en')).toBe('Price unavailable')
    expect(formatBookingOptionPrice(null, 'SAR', 'ar')).toBe('السعر غير متوفر')
    expect(formatBookingOptionPrice(420, 'SAR', 'en')).toContain('420')
  })

  it('matches select flight|hotel commands from card clicks', () => {
    const cards = buildBookingOptionsFromPlan(samplePlan())
    const flight = cards.find((c) => c.kind === 'flight')!
    const hotel = cards.find((c) => c.kind === 'hotel')!
    expect(matchBookingOptionSelection(`select flight ${flight.id}`, cards)?.id).toBe(flight.id)
    expect(matchBookingOptionSelection(`select hotel ${hotel.id}`, cards)?.id).toBe(hotel.id)
    expect(matchBookingOptionSelection('select flight missing', cards)).toBeNull()
  })
})
