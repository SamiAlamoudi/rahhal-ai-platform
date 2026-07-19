/**
 * Sprint 33 — Booking timeline helpers.
 */

import type { BookingTimelineEntry, ExecutionState } from './ExecutionTypes'

export class BookingTimeline {
  private readonly entries: BookingTimelineEntry[] = []

  add(state: ExecutionState, label: string, detail?: string): BookingTimelineEntry {
    const entry: BookingTimelineEntry = {
      id: `tl_${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      state,
      label,
      detail,
    }
    this.entries.push(entry)
    return entry
  }

  list(): BookingTimelineEntry[] {
    return [...this.entries]
  }

  hydrate(entries: BookingTimelineEntry[]): void {
    this.entries.length = 0
    this.entries.push(...entries)
  }
}
