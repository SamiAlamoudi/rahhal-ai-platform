/**
 * Sprint 39 — Travel documents event bus.
 */

export type TravelDocumentsEventTypeName =
  | 'RulesEvaluated'
  | 'PassportAssessed'
  | 'VisaAssessed'
  | 'VaccinationAssessed'
  | 'AlertsGenerated'
  | 'DocumentsExplained'
  | 'DocumentsHandled'

export interface TravelDocumentsEvent {
  type: TravelDocumentsEventTypeName
  at: string
  userId: string
  data?: Record<string, unknown>
}

export type TravelDocumentsEventListener = (event: TravelDocumentsEvent) => void

export class TravelDocumentsEvents {
  private readonly listeners = new Map<
    TravelDocumentsEventTypeName | '*',
    Set<TravelDocumentsEventListener>
  >()

  on(
    type: TravelDocumentsEventTypeName | '*',
    listener: TravelDocumentsEventListener,
  ): () => void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
    return () => {
      set.delete(listener)
    }
  }

  emit(event: TravelDocumentsEvent): void {
    const specific = this.listeners.get(event.type)
    if (specific) for (const l of specific) l(event)
    const all = this.listeners.get('*')
    if (all) for (const l of all) l(event)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export function createTravelDocumentsEvent(
  type: TravelDocumentsEventTypeName,
  userId: string,
  data?: Record<string, unknown>,
): TravelDocumentsEvent {
  return { type, at: new Date().toISOString(), userId, data }
}
