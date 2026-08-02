import { describe, expect, it } from 'vitest'
import { emptyPreferenceProfile } from '../preferences'
import { RecommendationEngine } from './RecommendationEngine'

describe('RecommendationEngine', () => {
  const eng = new RecommendationEngine()

  it('ranks flights with preference and goal boosts', () => {
    const prefs = emptyPreferenceProfile()
    prefs.favoriteAirlines = ['Emirates']
    const ranked = eng.rankFlights(
      { destination: 'Dubai', budgetAmount: 2000, origin: 'Riyadh' },
      prefs,
      ['business'],
    )
    expect(ranked[0]?.score).toBeGreaterThan(0)
    expect(ranked.some((r) => r.reasons.includes('preferred_airline'))).toBe(true)
  })

  it('ranks hotels and packages', () => {
    const prefs = emptyPreferenceProfile()
    prefs.favoriteHotels = ['Pera Palace']
    prefs.travelStyle = 'luxury'
    const hotels = eng.rankHotels(
      { destination: 'Istanbul', budgetAmount: 4000, durationNights: 4, hotelClass: 5 },
      prefs,
    )
    expect(hotels[0]?.item.city).toBe('Istanbul')
    const packages = eng.rankPackages({ destination: 'Istanbul', budgetAmount: 6000 }, prefs)
    expect(packages.some((p) => p.reasons.includes('luxury_goal'))).toBe(true)
  })

  it('penalizes over-budget options', () => {
    const ranked = eng.rankFlights({ budgetAmount: 100 }, emptyPreferenceProfile())
    expect(ranked.every((r) => r.score <= 1)).toBe(true)
  })

  it('covers near-budget and hotel nightly fallback branches', () => {
    const near = eng.rankFlights({ budgetAmount: 900 }, emptyPreferenceProfile())
    expect(near.length).toBeGreaterThan(0)
    const hotels = eng.rankHotels({ budgetAmount: 800 }, emptyPreferenceProfile())
    expect(hotels[0]?.score).toBeGreaterThan(0)
    const noBudget = eng.rankFlights({}, emptyPreferenceProfile())
    expect(noBudget[0]?.reasons.some((r) => r.startsWith('price:'))).toBe(true)
  })
})

