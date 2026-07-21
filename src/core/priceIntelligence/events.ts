/**
 * Sprint 81 — price intelligence observability events.
 */

export type PriceEventName =
  | 'price.analysis.started'
  | 'price.analysis.finished'
  | 'booking.recommendation'
  | 'timing.confidence'
  | 'opportunity.detected'

export interface PriceEvent {
  name: PriceEventName
  at: string
  payload: Record<string, unknown>
}

export type PriceEventListener = (event: PriceEvent) => void

const listeners = new Set<PriceEventListener>()

export function onPriceEvent(listener: PriceEventListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitPriceEvent(
  name: PriceEventName,
  payload: Record<string, unknown> = {},
  sink?: PriceEvent[],
): PriceEvent {
  const event: PriceEvent = {
    name,
    at: new Date().toISOString(),
    payload,
  }
  sink?.push(event)
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // never break pricing path
    }
  }
  return event
}

export function resetPriceEventListeners(): void {
  listeners.clear()
}
