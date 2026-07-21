/**
 * Sprint 79 — lightweight observability event bus (in-memory).
 */

import type { DecisionEvent, DecisionEventName } from '../types'

export type DecisionEventListener = (event: DecisionEvent) => void

const listeners = new Set<DecisionEventListener>()

export function onDecisionEvent(listener: DecisionEventListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitDecisionEvent(
  name: DecisionEventName,
  payload: Record<string, unknown> = {},
  sink?: DecisionEvent[],
): DecisionEvent {
  const event: DecisionEvent = {
    name,
    at: new Date().toISOString(),
    payload,
  }
  sink?.push(event)
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // Observability must never break decision flow.
    }
  }
  return event
}

export function resetDecisionEventListeners(): void {
  listeners.clear()
}
