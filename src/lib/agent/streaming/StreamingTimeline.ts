/**
 * Sprint 116 — StreamingTimeline
 * Chronological execution history.
 */

import type { StreamingEvent } from './StreamingEvents'
import type { StreamingStageId } from './StreamingStage'

export interface StreamingTimelineEntry {
  timestamp: number
  at: string
  stage: StreamingStageId
  status: StreamingEvent['status']
  kind: StreamingEvent['kind']
  message: string
  durationMs: number | null
  confidence: number | null
  progressPercent: number
}

export class StreamingTimeline {
  private readonly entries: StreamingTimelineEntry[] = []

  append(event: StreamingEvent): void {
    this.entries.push({
      timestamp: event.timestamp,
      at: event.at,
      stage: event.stage,
      status: event.status,
      kind: event.kind,
      message: event.message,
      durationMs: event.durationMs,
      confidence: event.confidence,
      progressPercent: event.progressPercent,
    })
  }

  getEntries(): readonly StreamingTimelineEntry[] {
    return this.entries.slice()
  }

  /** Chronological copy sorted by timestamp then insertion order. */
  chronological(): StreamingTimelineEntry[] {
    return this.entries
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp || a.at.localeCompare(b.at))
  }

  isChronologicallyIntact(): boolean {
    for (let i = 1; i < this.entries.length; i++) {
      if (this.entries[i]!.timestamp < this.entries[i - 1]!.timestamp) {
        return false
      }
    }
    return true
  }

  clear(): void {
    this.entries.length = 0
  }
}

export function createStreamingTimeline(): StreamingTimeline {
  return new StreamingTimeline()
}

export function timelineFromEvents(
  events: readonly StreamingEvent[],
): StreamingTimeline {
  const timeline = createStreamingTimeline()
  for (const e of events) timeline.append(e)
  return timeline
}
