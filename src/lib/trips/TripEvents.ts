/**
 * Sprint 35 — Trip event bus.
 */

export type TripEventType =
  | 'TripCreated'
  | 'ItineraryGenerated'
  | 'DocumentsGenerated'
  | 'NotificationScheduled'
  | 'NotificationSent'
  | 'FlightStatusUpdated'
  | 'TripLifecycleChanged'
  | 'TripCancelled'
  | 'RefundStatusUpdated'

export interface TripEvent {
  type: TripEventType
  at: string
  tripId: string
  data?: Record<string, unknown>
}

export type TripEventListener = (event: TripEvent) => void

export class TripEvents {
  private readonly listeners = new Map<TripEventType | '*', Set<TripEventListener>>()

  on(type: TripEventType | '*', listener: TripEventListener): () => void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
    return () => {
      set.delete(listener)
    }
  }

  emit(event: TripEvent): void {
    const specific = this.listeners.get(event.type)
    if (specific) for (const l of specific) l(event)
    const all = this.listeners.get('*')
    if (all) for (const l of all) l(event)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export function createTripEvent(
  type: TripEventType,
  tripId: string,
  data?: Record<string, unknown>,
): TripEvent {
  return {
    type,
    at: new Date().toISOString(),
    tripId,
    data,
  }
}
