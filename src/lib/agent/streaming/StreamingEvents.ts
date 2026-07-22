/**
 * Sprint 116 — StreamingEvents
 */

import type { StreamingStageId } from './StreamingStage'
import type {
  StreamingEventKind,
  StreamingProgressPercent,
  StreamingStageStatus,
} from './StreamingStatus'

export interface StreamingEvent {
  id: string
  at: string
  timestamp: number
  stage: StreamingStageId
  kind: StreamingEventKind
  status: StreamingStageStatus
  message: string
  progressPercent: StreamingProgressPercent
  durationMs: number | null
  confidence: number | null
  metadata: Record<string, unknown>
  warning?: string | null
  error?: string | null
}

export type StreamingEventListener = (event: StreamingEvent) => void

let eventSeq = 0

export function createStreamingEvent(input: {
  stage: StreamingStageId
  kind: StreamingEventKind
  status: StreamingStageStatus
  message: string
  progressPercent: StreamingProgressPercent
  durationMs?: number | null
  confidence?: number | null
  metadata?: Record<string, unknown>
  warning?: string | null
  error?: string | null
  at?: string
  timestamp?: number
}): StreamingEvent {
  eventSeq += 1
  const timestamp = input.timestamp ?? Date.now()
  return {
    id: `sev_${eventSeq}`,
    at: input.at ?? new Date(timestamp).toISOString(),
    timestamp,
    stage: input.stage,
    kind: input.kind,
    status: input.status,
    message: input.message,
    progressPercent: input.progressPercent,
    durationMs: input.durationMs ?? null,
    confidence: input.confidence ?? null,
    metadata: input.metadata ?? {},
    warning: input.warning ?? null,
    error: input.error ?? null,
  }
}

export class StreamingEventBus {
  private readonly listeners: StreamingEventListener[] = []
  private readonly events: StreamingEvent[] = []

  subscribe(listener: StreamingEventListener): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx >= 0) this.listeners.splice(idx, 1)
    }
  }

  emit(event: StreamingEvent): void {
    this.events.push(event)
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  getEvents(): readonly StreamingEvent[] {
    return this.events.slice()
  }

  clear(): void {
    this.events.length = 0
  }
}

export function createStreamingEventBus(): StreamingEventBus {
  return new StreamingEventBus()
}
