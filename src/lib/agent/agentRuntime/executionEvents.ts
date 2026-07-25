/**
 * Phase 6 — ExecutionEvents
 * Publish-only event bus for runtime observability (no production UI).
 */

import type { RuntimeEvent, RuntimeEventType } from './types'

export class ExecutionEvents {
  private readonly events: RuntimeEvent[] = []
  private readonly listeners = new Set<(event: RuntimeEvent) => void>()

  on(listener: (event: RuntimeEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  publish(type: RuntimeEventType, detail: string, meta?: Record<string, unknown>): RuntimeEvent {
    const event: RuntimeEvent = {
      type,
      at: new Date().toISOString(),
      detail,
      meta,
    }
    this.events.push(event)
    for (const listener of this.listeners) listener(event)
    return event
  }

  list(): RuntimeEvent[] {
    return this.events.slice()
  }

  clear(): void {
    this.events.length = 0
  }
}
