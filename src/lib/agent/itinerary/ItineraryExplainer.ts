/**
 * Sprint 114 — ItineraryExplainer
 * Explains why activities, order, hotels, and flights fit the schedule.
 */

import type { NormalizedItineraryContext } from './DayPlanner'
import type { ItineraryDayPlan, ItineraryExplanation, ItineraryTimeBlock } from './types'

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

export function explainItinerary(
  days: ItineraryDayPlan[],
  ctx: NormalizedItineraryContext,
  conflictsResolved: number,
): ItineraryExplanation {
  const blocks = days.flatMap((d) => d.blocks)
  const activityReasons: string[] = []

  for (const b of blocks) {
    if (
      b.kind === 'activity'
      || b.kind === 'sightseeing'
      || b.kind === 'business_meeting'
    ) {
      activityReasons.push(b.why || `${b.title}: allocated for ${ctx.style} travel.`)
    }
  }

  const orderingReasons = [
    'Daily order: morning → afternoon → evening → night with meals and transfers between blocks.',
  ]
  if (ctx.cities.length > 1) {
    orderingReasons.push(
      'Multi-city stays insert daytime inter-city transfers when the city changes.',
    )
  }
  if (conflictsResolved > 0) {
    orderingReasons.push(
      `${conflictsResolved} schedule conflict(s) were auto-resolved by shifting or dropping soft blocks.`,
    )
  }
  if (ctx.style === 'business') {
    orderingReasons.push('Business meetings take contiguous daytime windows with transfer buffers.')
  }
  if (ctx.style === 'family') {
    orderingReasons.push('Family days keep free-time buffers and avoid tight evening stacks.')
  }

  const hotelFit = ctx.hotelName
    ? `Hotel «${ctx.hotelName}» anchors check-in after arrival transfer and check-out before departure transfer (${ctx.checkInDate} → ${ctx.checkOutDate}).`
    : 'No hotel selected; schedule focuses on flights, transfers, and activities.'

  const flightParts: string[] = []
  if (ctx.flightArrivalMinutes != null) {
    flightParts.push(
      `Inbound arrival around minute ${ctx.flightArrivalMinutes} sets the arrival-day transfer and check-in window.`,
    )
  }
  if (ctx.flightDepartureMinutes != null) {
    flightParts.push(
      `Departure around minute ${ctx.flightDepartureMinutes} sets check-out and hotel→airport transfer timing.`,
    )
  }
  if (ctx.arrivalDelayMinutes > 0) {
    flightParts.push(`Applied arrival delay of ${ctx.arrivalDelayMinutes} minutes.`)
  }
  if (flightParts.length === 0) {
    flightParts.push('No flight times provided; day bounds use stay dates only.')
  }

  const summary = [
    `Itinerary for ${days.length} day(s) across ${ctx.cities.map((c) => c.city).join(' → ') || ctx.destination}.`,
    `Style: ${ctx.style}.`,
    activityReasons.length ? `${activityReasons.length} activity/meeting block(s).` : 'Light activity load.',
  ].join(' ')

  return {
    summary,
    activityReasons: unique(activityReasons).slice(0, 12),
    orderingReasons: unique(orderingReasons),
    hotelFit,
    flightFit: flightParts.join(' '),
  }
}

export function explainBlock(block: ItineraryTimeBlock): string {
  return block.why || block.title
}

export class ItineraryExplainer {
  explain(
    days: ItineraryDayPlan[],
    ctx: NormalizedItineraryContext,
    conflictsResolved: number,
  ): ItineraryExplanation {
    return explainItinerary(days, ctx, conflictsResolved)
  }
}

export function createItineraryExplainer(): ItineraryExplainer {
  return new ItineraryExplainer()
}
