/**
 * Sprint 114 — ItineraryScorer
 * Comfort, walking, efficiency, family/business suitability, overall quality.
 */

import type { NormalizedItineraryContext } from './DayPlanner'
import type { ItineraryDayPlan, ItineraryScores } from './types'

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function scoreItinerary(
  days: ItineraryDayPlan[],
  ctx: NormalizedItineraryContext,
): ItineraryScores {
  const blocks = days.flatMap((d) => d.blocks)
  const walkingMinutes = days.reduce((s, d) => s + d.walkingMinutes, 0)
  const transferMinutes = days.reduce((s, d) => s + d.transferMinutes, 0)
  const freeMinutes = days.reduce((s, d) => s + d.freeMinutes, 0)
  const meetings = blocks.filter((b) => b.kind === 'business_meeting').length
  const activities = blocks.filter(
    (b) =>
      b.kind === 'activity'
      || b.kind === 'sightseeing'
      || b.kind === 'business_meeting',
  ).length
  const meals = blocks.filter((b) => b.kind === 'meal').length

  const comfort = clamp(
    55
      + Math.min(25, freeMinutes / 30)
      + (ctx.style === 'leisure' ? 8 : 0)
      - Math.min(20, walkingMinutes / 20)
      - (ctx.arrivalDelayMinutes > 60 ? 8 : 0),
  )

  const walking = clamp(100 - walkingMinutes / 3)

  const travelEfficiency = clamp(
    70
      + Math.min(20, activities * 4)
      - Math.min(25, transferMinutes / 15)
      + (ctx.cities.length > 1 ? 5 : 0),
  )

  const familyFriendliness =
    ctx.style === 'family' || ctx.children > 0
      ? clamp(70 + Math.min(20, freeMinutes / 20) + meals * 2 - walkingMinutes / 25)
      : clamp(50 + Math.min(15, freeMinutes / 30) + meals)

  const businessSuitability =
    ctx.style === 'business'
      ? clamp(60 + meetings * 12 + (days.length >= 2 ? 10 : 0))
      : clamp(40 + meetings * 10)

  const overallQuality = clamp(
    comfort * 0.25
      + walking * 0.15
      + travelEfficiency * 0.25
      + familyFriendliness * 0.15
      + businessSuitability * 0.2,
  )

  return {
    comfort,
    walking,
    travelEfficiency,
    familyFriendliness,
    businessSuitability,
    overallQuality,
  }
}

export class ItineraryScorer {
  score(days: ItineraryDayPlan[], ctx: NormalizedItineraryContext): ItineraryScores {
    return scoreItinerary(days, ctx)
  }
}

export function createItineraryScorer(): ItineraryScorer {
  return new ItineraryScorer()
}
