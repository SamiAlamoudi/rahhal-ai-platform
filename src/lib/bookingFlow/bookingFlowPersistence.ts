/**
 * Sprint 25 — booking flow local persistence (refresh / back-navigation safe).
 */

import type { BookingFlowState } from './types'

const DEFAULT_PREFIX = 'rahhal_booking_flow_v1:'
const memoryStore = new Map<string, string>()

function keyFor(userId: string, flowId: string, prefix: string): string {
  return `${prefix}${userId}:${flowId}`
}

function userIndexKey(userId: string, prefix: string): string {
  return `${prefix}index:${userId}`
}

function storageSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value)
      return
    }
  } catch {
    // fall through
  }
  memoryStore.set(key, value)
}

function storageGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key)
    }
  } catch {
    // fall through
  }
  return memoryStore.get(key) ?? null
}

function storageRemove(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
    }
  } catch {
    // ignore
  }
  memoryStore.delete(key)
}

export function saveBookingFlowState(
  state: BookingFlowState,
  prefix = DEFAULT_PREFIX,
): void {
  storageSet(keyFor(state.userId, state.id, prefix), JSON.stringify(state))
  const indexKey = userIndexKey(state.userId, prefix)
  const raw = storageGet(indexKey)
  let ids: string[] = []
  if (raw) {
    try {
      ids = JSON.parse(raw) as string[]
    } catch {
      ids = []
    }
  }
  if (!ids.includes(state.id)) ids.push(state.id)
  storageSet(indexKey, JSON.stringify(ids))
  // Latest pointer for resume without knowing flow id
  storageSet(`${prefix}latest:${state.userId}`, state.id)
}

export function loadBookingFlowState(
  userId: string,
  flowId: string,
  prefix = DEFAULT_PREFIX,
): BookingFlowState | null {
  const raw = storageGet(keyFor(userId, flowId, prefix))
  if (!raw) return null
  try {
    return JSON.parse(raw) as BookingFlowState
  } catch {
    return null
  }
}

export function loadLatestBookingFlowState(
  userId: string,
  prefix = DEFAULT_PREFIX,
): BookingFlowState | null {
  const latestId = storageGet(`${prefix}latest:${userId}`)
  if (!latestId) return null
  return loadBookingFlowState(userId, latestId, prefix)
}

export function loadBookingFlowBySessionId(
  userId: string,
  bookingSessionId: string,
  prefix = DEFAULT_PREFIX,
): BookingFlowState | null {
  const indexKey = userIndexKey(userId, prefix)
  const raw = storageGet(indexKey)
  if (!raw) return null
  let ids: string[] = []
  try {
    ids = JSON.parse(raw) as string[]
  } catch {
    return null
  }
  for (const id of ids) {
    const state = loadBookingFlowState(userId, id, prefix)
    if (state?.bookingSessionId === bookingSessionId) return state
  }
  return null
}

export function clearBookingFlowStatesForUser(
  userId: string,
  prefix = DEFAULT_PREFIX,
): void {
  const indexKey = userIndexKey(userId, prefix)
  const raw = storageGet(indexKey)
  if (raw) {
    try {
      const ids = JSON.parse(raw) as string[]
      for (const id of ids) storageRemove(keyFor(userId, id, prefix))
    } catch {
      // ignore
    }
  }
  storageRemove(indexKey)
  storageRemove(`${prefix}latest:${userId}`)
}

export { DEFAULT_PREFIX as BOOKING_FLOW_STORAGE_PREFIX }
