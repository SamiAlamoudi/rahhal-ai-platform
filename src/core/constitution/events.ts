/**
 * Sprint 87 — constitution observability events.
 */

export type ConstitutionEventName =
  | 'constitution.validation.started'
  | 'constitution.validation.passed'
  | 'constitution.validation.failed'
  | 'constitution.principle.checked'
  | 'constitution.violation'

export interface ConstitutionEvent {
  name: ConstitutionEventName
  at: string
  payload: Record<string, unknown>
}

export type ConstitutionEventListener = (event: ConstitutionEvent) => void

const listeners = new Set<ConstitutionEventListener>()

export function onConstitutionEvent(listener: ConstitutionEventListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitConstitutionEvent(
  name: ConstitutionEventName,
  payload: Record<string, unknown> = {},
  sink?: ConstitutionEvent[],
): ConstitutionEvent {
  const event: ConstitutionEvent = {
    name,
    at: new Date().toISOString(),
    payload,
  }
  sink?.push(event)
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // never break governance path
    }
  }
  return event
}

export function resetConstitutionEventListeners(): void {
  listeners.clear()
}
