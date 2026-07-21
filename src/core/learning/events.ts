/**
 * Sprint 80 — learning observability events (local only).
 */

export type LearningEventName =
  | 'learning.started'
  | 'learning.completed'
  | 'profile.updated'
  | 'preference.inferred'
  | 'recommendation.adjusted'
  | 'confidence.updated'

export interface LearningEvent {
  name: LearningEventName
  at: string
  payload: Record<string, unknown>
}

export type LearningEventListener = (event: LearningEvent) => void

const listeners = new Set<LearningEventListener>()

export function onLearningEvent(listener: LearningEventListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitLearningEvent(
  name: LearningEventName,
  payload: Record<string, unknown> = {},
  sink?: LearningEvent[],
): LearningEvent {
  const event: LearningEvent = {
    name,
    at: new Date().toISOString(),
    payload,
  }
  sink?.push(event)
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // never break learning path
    }
  }
  return event
}

export function resetLearningEventListeners(): void {
  listeners.clear()
}
