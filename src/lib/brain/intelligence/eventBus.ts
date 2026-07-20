/**
 * Sprint 53 — centralized live event bus.
 */

import type { LiveEvent, LiveEventType } from './types'

type Handler = (event: LiveEvent) => void

const handlers = new Map<LiveEventType | '*', Set<Handler>>()
const history: LiveEvent[] = []
const MAX_HISTORY = 200

export function onLiveEvent(type: LiveEventType | '*', handler: Handler): () => void {
  const set = handlers.get(type) ?? new Set<Handler>()
  set.add(handler)
  handlers.set(type, set)
  return () => {
    set.delete(handler)
  }
}

export function emitLiveEvent(event: LiveEvent): void {
  history.push(event)
  if (history.length > MAX_HISTORY) history.shift()
  for (const handler of handlers.get(event.type) ?? []) handler(event)
  for (const handler of handlers.get('*') ?? []) handler(event)
}

export function getLiveEventHistory(): LiveEvent[] {
  return [...history]
}

export function resetLiveEventBus(): void {
  handlers.clear()
  history.length = 0
}
