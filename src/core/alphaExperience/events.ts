/**
 * Sprint 91 — structured observability for the Alpha experience pipeline.
 */

import type { AlphaExperienceEvent, AlphaExperienceEventName } from './types'

export function emitAlphaEvent(
  name: AlphaExperienceEventName,
  detail: Record<string, unknown> = {},
  events: AlphaExperienceEvent[],
  durationMs?: number,
): void {
  events.push({
    name,
    at: new Date().toISOString(),
    durationMs,
    detail,
  })
}

export function resetAlphaEventList(events: AlphaExperienceEvent[]): void {
  events.length = 0
}
