/**
 * Sprint 15 — EventRecorder (sanitized domain events).
 */

import { sanitizeForLogs } from '../security/secrets/SecretSanitizer'
import { getCorrelationIdManager } from './CorrelationIdManager'
import { isObservabilityPlatformEnabled } from './feature'
import type { ObservabilityEvent } from './types'

function id(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export class EventRecorder {
  private readonly enabledOverride: boolean | undefined
  private readonly events: ObservabilityEvent[] = []
  private static readonly MAX = 1000

  constructor(options?: { enabled?: boolean }) {
    this.enabledOverride = options?.enabled
  }

  isEnabled(): boolean {
    return isObservabilityPlatformEnabled({ enabled: this.enabledOverride })
  }

  record(type: string, payload: Record<string, unknown> = {}): ObservabilityEvent | null {
    if (!this.isEnabled()) return null
    const ctx = getCorrelationIdManager().current()
    const event: ObservabilityEvent = {
      id: id(),
      type,
      at: new Date().toISOString(),
      requestId: ctx.requestId,
      conversationId: ctx.conversationId,
      payload: sanitizeForLogs(payload) as Record<string, unknown>,
    }
    this.events.push(event)
    if (this.events.length > EventRecorder.MAX) {
      this.events.splice(0, this.events.length - EventRecorder.MAX)
    }
    return event
  }

  list(type?: string): ObservabilityEvent[] {
    if (!type) return [...this.events]
    return this.events.filter((e) => e.type === type)
  }

  reset(): void {
    this.events.length = 0
  }
}

let shared: EventRecorder | null = null

export function getEventRecorder(options?: { enabled?: boolean }): EventRecorder {
  if (options) return new EventRecorder(options)
  if (!shared) shared = new EventRecorder()
  return shared
}

export function resetEventRecorderForTests(): void {
  shared?.reset()
  shared = null
}

export function createEventRecorder(options?: { enabled?: boolean }): EventRecorder {
  return new EventRecorder(options)
}
