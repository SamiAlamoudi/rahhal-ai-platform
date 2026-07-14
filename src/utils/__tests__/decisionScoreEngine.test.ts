import { describe, it, expect } from 'vitest'
import { scoreOption, scoreOptions } from '../decisionScoreEngine'
import type { ScoreableOption } from '../decisionScoreEngine'
import { buildTravelSearchRequest } from '../travelSearchRequest'
import {
  createEmptyTravelSession,
  mergeTravelSession,
  confirmDecisionProfile,
} from '../travelSession'

const MSG1 = 'أريد السفر إلى اليابان لمدة 10 أيام مع زوجتي وطفلين وميزانيتي 20 ألف ريال.'

function makeRequest() {
  let s = mergeTravelSession(createEmptyTravelSession(), MSG1)
  s = mergeTravelSession(s, 'من الرياض')
  s = mergeTravelSession(s, '15 أكتوبر')
  s = confirmDecisionProfile(s)
  return buildTravelSearchRequest(s)
}

const STRONG_OPTION: ScoreableOption = {
  price: 5000,
  currency: 'SAR',
  cabin: 'business',
  directFlight: true,
  stops: 0,
  durationMinutes: 600,
  familyFriendly: true,
  breakfastIncluded: true,
  freeCancellation: true,
  hotelStars: 5,
  hotelRating: 4.8,
  amenities: ['family-rooms', 'crib', 'pool', 'spa', 'gym', 'wifi'],
  area: 'Tokyo',
  destination: 'Japan',
  activityType: 'entertainment',
}

const WEAK_OPTION: ScoreableOption = {
  price: 25000,
  currency: 'SAR',
  cabin: 'economy',
  directFlight: false,
  stops: 2,
  durationMinutes: 1500,
  familyFriendly: false,
  hotelStars: 1,
  hotelRating: 2.0,
  amenities: [],
}

describe('Scenario 7: Scoring', () => {
  it('keeps every category score between 0 and 100', () => {
    const req = makeRequest()
    const result = scoreOption(STRONG_OPTION, req)
    for (const cat of result.categories) {
      expect(cat.score).toBeGreaterThanOrEqual(0)
      expect(cat.score).toBeLessThanOrEqual(100)
    }
  })

  it('keeps weighted average between 0 and 100', () => {
    const req = makeRequest()
    const result = scoreOption(STRONG_OPTION, req)
    expect(result.weightedAverage).toBeGreaterThanOrEqual(0)
    expect(result.weightedAverage).toBeLessThanOrEqual(100)
  })

  it('ranks the stronger option above the weaker option', () => {
    const req = makeRequest()
    const ranked = scoreOptions([WEAK_OPTION, STRONG_OPTION], req)
    expect(ranked[0].option).toBe(STRONG_OPTION)
    expect(ranked[0].score.weightedAverage).toBeGreaterThan(ranked[1].score.weightedAverage)
  })

  it('produces identical output for identical input', () => {
    const req = makeRequest()
    const r1 = scoreOption(STRONG_OPTION, req)
    const r2 = scoreOption(STRONG_OPTION, req)
    expect(r1.weightedAverage).toBe(r2.weightedAverage)
    expect(r1.confidence).toBe(r2.confidence)
    expect(r1.recommendation).toBe(r2.recommendation)
  })
})
