/**
 * Sprint 84 — itinerary refinement observability.
 */

export type RefinementEventName =
  | 'refinement.started'
  | 'refinement.planned'
  | 'refinement.conflict'
  | 'refinement.optimized'
  | 'refinement.completed'
  | 'refinement.alternative'

export interface RefinementEvent {
  name: RefinementEventName
  at: string
  payload: Record<string, unknown>
}

export type RefinementEventListener = (event: RefinementEvent) => void

const listeners = new Set<RefinementEventListener>()

export function onRefinementEvent(listener: RefinementEventListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitRefinementEvent(
  name: RefinementEventName,
  payload: Record<string, unknown> = {},
  sink?: RefinementEvent[],
): RefinementEvent {
  const event: RefinementEvent = {
    name,
    at: new Date().toISOString(),
    payload,
  }
  sink?.push(event)
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // never break refinement path
    }
  }
  return event
}

export function resetRefinementEventListeners(): void {
  listeners.clear()
}
