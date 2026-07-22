/**
 * Sprint 114 — ItineraryMetadata
 * Aggregates travel time, nights, walking/transfers, activities, confidence.
 */

import type { NormalizedItineraryContext } from './DayPlanner'
import { hotelNights } from './DayPlanner'
import type { ItineraryDayPlan, ItineraryMetadata, ItineraryScores } from './types'

export function buildItineraryMetadata(
  days: ItineraryDayPlan[],
  ctx: NormalizedItineraryContext,
  scores: ItineraryScores,
  conflictCount: number,
  resolvedConflictCount: number,
): ItineraryMetadata {
  const blocks = days.flatMap((d) => d.blocks)
  const walkingDurationMinutes = days.reduce((s, d) => s + d.walkingMinutes, 0)
  const transferDurationMinutes = days.reduce((s, d) => s + d.transferMinutes, 0)
  const freeMinutes = days.reduce((s, d) => s + d.freeMinutes, 0)
  const activityCount = blocks.filter(
    (b) =>
      b.kind === 'activity'
      || b.kind === 'sightseeing'
      || b.kind === 'business_meeting',
  ).length

  const flightDurationMinutes = ctx.flightDurationMinutes
  const nights = hotelNights(ctx)
  const totalTravelTimeMinutes =
    flightDurationMinutes + transferDurationMinutes + walkingDurationMinutes

  let confidence = 0.55
  if (ctx.flightArrivalMinutes != null) confidence += 0.1
  if (ctx.hotelName) confidence += 0.1
  if (days.length >= 2) confidence += 0.08
  if (activityCount > 0) confidence += 0.06
  if (resolvedConflictCount === conflictCount && conflictCount === 0) confidence += 0.05
  else confidence -= Math.min(0.12, resolvedConflictCount * 0.03)
  if (scores.overallQuality >= 70) confidence += 0.06
  if (!ctx.destination) confidence -= 0.2
  if (days.length === 0) confidence = 0.2
  confidence = Math.max(0.2, Math.min(0.98, confidence))

  return {
    totalTravelTimeMinutes,
    hotelNights: nights,
    flightDurationMinutes,
    walkingDurationMinutes,
    transferDurationMinutes,
    activityCount,
    freeHours: Math.round((freeMinutes / 60) * 10) / 10,
    dayCount: days.length,
    cityCount: new Set(days.map((d) => d.city)).size || ctx.cities.length,
    confidence: Math.round(confidence * 100) / 100,
    style: ctx.style,
    conflictCount,
    resolvedConflictCount,
  }
}

export class ItineraryMetadataBuilder {
  build(
    days: ItineraryDayPlan[],
    ctx: NormalizedItineraryContext,
    scores: ItineraryScores,
    conflictCount: number,
    resolvedConflictCount: number,
  ): ItineraryMetadata {
    return buildItineraryMetadata(
      days,
      ctx,
      scores,
      conflictCount,
      resolvedConflictCount,
    )
  }
}

export function createItineraryMetadataBuilder(): ItineraryMetadataBuilder {
  return new ItineraryMetadataBuilder()
}
