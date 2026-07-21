/**
 * Sprint 62 — append-only trip timeline.
 */

import type { TripTimelineEvent, TripTimelineEventType } from './types'

let seq = 0

export function resetTimelineSeq(): void {
  seq = 0
}

export function createTimelineEvent(input: {
  type: TripTimelineEventType
  provider?: string | null
  details?: Record<string, unknown>
  timestamp?: string
  now?: () => number
}): TripTimelineEvent {
  const now = input.now ?? (() => Date.now())
  seq += 1
  return {
    id: `tev_${now().toString(36)}_${seq.toString(36)}`,
    timestamp: input.timestamp ?? new Date(now()).toISOString(),
    type: input.type,
    provider: input.provider ?? null,
    details: input.details ?? {},
  }
}

/** Append event; never mutates previous events (returns new array). */
export function appendTimelineEvent(
  timeline: readonly TripTimelineEvent[],
  event: TripTimelineEvent,
): TripTimelineEvent[] {
  return [...timeline, event]
}

export function hasTimelineEventType(
  timeline: readonly TripTimelineEvent[],
  type: TripTimelineEventType,
): boolean {
  return timeline.some((e) => e.type === type)
}
