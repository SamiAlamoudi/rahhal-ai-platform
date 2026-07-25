/**
 * Integration Sprint 11 — execution memory (pending / confirmation / completed / history).
 * In-process only; additive.
 */

import type {
  ActionExecutionMemory,
  ActionHistoryEntry,
  PendingAction,
} from './types'

const store = new Map<string, ActionExecutionMemory>()

function emptyMemory(): ActionExecutionMemory {
  return {
    pending: null,
    lastConfirmation: null,
    completed: null,
    history: [],
  }
}

export function readActionMemory(userId?: string | null): ActionExecutionMemory {
  if (!userId) return emptyMemory()
  const existing = store.get(userId)
  if (!existing) return emptyMemory()
  return {
    ...existing,
    history: [...existing.history],
  }
}

export function writeActionMemory(
  userId: string | null | undefined,
  next: ActionExecutionMemory,
): ActionExecutionMemory {
  const key = userId ?? 'anonymous'
  const stored: ActionExecutionMemory = {
    ...next,
    history: next.history.slice(-20),
  }
  store.set(key, stored)
  return readActionMemory(key)
}

export function setPendingAction(
  userId: string | null | undefined,
  pending: PendingAction | null,
): ActionExecutionMemory {
  const prev = readActionMemory(userId ?? 'anonymous')
  return writeActionMemory(userId, { ...prev, pending })
}

export function recordHistory(
  userId: string | null | undefined,
  entry: ActionHistoryEntry,
): ActionExecutionMemory {
  const prev = readActionMemory(userId ?? 'anonymous')
  const completed = entry.status === 'completed' ? entry : prev.completed
  return writeActionMemory(userId, {
    ...prev,
    completed,
    history: [...prev.history, entry].slice(-20),
  })
}

export function resetActionMemoryForTests(): void {
  store.clear()
}
