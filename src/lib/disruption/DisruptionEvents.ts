/**
 * Sprint 37 — Disruption event bus.
 */

export type DisruptionEventTypeName =
  | 'DisruptionDetected'
  | 'ImpactCalculated'
  | 'RecoveryOptionsGenerated'
  | 'RecoveryPlanSelected'
  | 'TripUpdated'
  | 'UserNotified'
  | 'DisruptionHandled'

export interface DisruptionEvent {
  type: DisruptionEventTypeName
  at: string
  tripId: string
  data?: Record<string, unknown>
}

export type DisruptionEventListener = (event: DisruptionEvent) => void

export class DisruptionEvents {
  private readonly listeners = new Map<DisruptionEventTypeName | '*', Set<DisruptionEventListener>>()

  on(type: DisruptionEventTypeName | '*', listener: DisruptionEventListener): () => void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
    return () => {
      set.delete(listener)
    }
  }

  emit(event: DisruptionEvent): void {
    const specific = this.listeners.get(event.type)
    if (specific) for (const l of specific) l(event)
    const all = this.listeners.get('*')
    if (all) for (const l of all) l(event)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export function createDisruptionEvent(
  type: DisruptionEventTypeName,
  tripId: string,
  data?: Record<string, unknown>,
): DisruptionEvent {
  return { type, at: new Date().toISOString(), tripId, data }
}
