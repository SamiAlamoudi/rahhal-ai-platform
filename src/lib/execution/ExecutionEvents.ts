/**
 * Sprint 33 — Execution event bus.
 */

import type { ExecutionEvent, ExecutionEventType } from './ExecutionTypes'

export type ExecutionEventListener = (event: ExecutionEvent) => void

export class ExecutionEvents {
  private readonly listeners = new Map<ExecutionEventType | '*', Set<ExecutionEventListener>>()

  on(type: ExecutionEventType | '*', listener: ExecutionEventListener): () => void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
    return () => {
      set.delete(listener)
    }
  }

  emit(event: ExecutionEvent): void {
    const specific = this.listeners.get(event.type)
    if (specific) for (const l of specific) l(event)
    const all = this.listeners.get('*')
    if (all) for (const l of all) l(event)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export function createExecutionEvent(
  type: ExecutionEventType,
  sessionId: string,
  data?: Record<string, unknown>,
): ExecutionEvent {
  return {
    type,
    at: new Date().toISOString(),
    sessionId,
    data,
  }
}
