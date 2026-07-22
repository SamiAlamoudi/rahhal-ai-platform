/**
 * Sprint 114 — TimelineBuilder
 * Assembles day parts and sorts blocks onto a daily timeline.
 */

import type { ItineraryDayPlan, ItineraryTimeBlock } from './types'

function sortBlocks(blocks: ItineraryTimeBlock[]): ItineraryTimeBlock[] {
  return [...blocks].sort(
    (a, b) =>
      a.startMinutes - b.startMinutes
      || a.endMinutes - b.endMinutes
      || a.id.localeCompare(b.id),
  )
}

export function partitionDayParts(blocks: ItineraryTimeBlock[]): {
  morning: ItineraryTimeBlock[]
  afternoon: ItineraryTimeBlock[]
  evening: ItineraryTimeBlock[]
  night: ItineraryTimeBlock[]
} {
  return {
    morning: blocks.filter((b) => b.dayPart === 'morning'),
    afternoon: blocks.filter((b) => b.dayPart === 'afternoon'),
    evening: blocks.filter((b) => b.dayPart === 'evening'),
    night: blocks.filter((b) => b.dayPart === 'night'),
  }
}

export function summarizeDayMinutes(blocks: ItineraryTimeBlock[]): {
  freeMinutes: number
  walkingMinutes: number
  transferMinutes: number
} {
  const walkingMinutes = blocks
    .filter((b) => b.kind === 'walking')
    .reduce((s, b) => s + b.durationMinutes, 0)
  const transferMinutes = blocks
    .filter((b) => b.kind === 'transfer')
    .reduce((s, b) => s + b.durationMinutes, 0)
  const freeMinutes = blocks
    .filter((b) => b.kind === 'free_time' || b.kind === 'rest')
    .reduce((s, b) => s + b.durationMinutes, 0)
  return { freeMinutes, walkingMinutes, transferMinutes }
}

export function buildDayTimeline(
  day: ItineraryDayPlan,
  blocks: ItineraryTimeBlock[],
): ItineraryDayPlan {
  const sorted = sortBlocks(blocks)
  const parts = partitionDayParts(sorted)
  const mins = summarizeDayMinutes(sorted)
  return {
    ...day,
    blocks: sorted,
    ...parts,
    ...mins,
  }
}

export function flattenTimeline(days: ItineraryDayPlan[]): ItineraryTimeBlock[] {
  return days.flatMap((d) => d.blocks)
}

export class TimelineBuilder {
  buildDay(day: ItineraryDayPlan, blocks: ItineraryTimeBlock[]): ItineraryDayPlan {
    return buildDayTimeline(day, blocks)
  }

  flatten(days: ItineraryDayPlan[]): ItineraryTimeBlock[] {
    return flattenTimeline(days)
  }
}

export function createTimelineBuilder(): TimelineBuilder {
  return new TimelineBuilder()
}
