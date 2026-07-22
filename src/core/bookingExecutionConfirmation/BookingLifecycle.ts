/**
 * Sprint 102 — booking lifecycle helpers.
 */

import type { BookingExecutionLifecycle } from './types'

export interface BookingLifecycleSnapshot {
  status: BookingExecutionLifecycle
  pendingAt: string | null
  confirmedAt: string | null
  failedAt: string | null
  cancelledAt: string | null
  lastError: string | null
}

export function createPendingLifecycle(now = new Date().toISOString()): BookingLifecycleSnapshot {
  return {
    status: 'pending',
    pendingAt: now,
    confirmedAt: null,
    failedAt: null,
    cancelledAt: null,
    lastError: null,
  }
}

export function transitionLifecycle(
  current: BookingLifecycleSnapshot,
  next: BookingExecutionLifecycle,
  options?: { error?: string | null; at?: string },
): BookingLifecycleSnapshot {
  const at = options?.at ?? new Date().toISOString()
  if (next === 'pending') {
    return { ...createPendingLifecycle(at), lastError: null }
  }
  if (next === 'confirmed') {
    return {
      ...current,
      status: 'confirmed',
      confirmedAt: at,
      failedAt: null,
      cancelledAt: null,
      lastError: null,
    }
  }
  if (next === 'failed') {
    return {
      ...current,
      status: 'failed',
      failedAt: at,
      lastError: options?.error ?? current.lastError ?? 'Booking failed.',
    }
  }
  return {
    ...current,
    status: 'cancelled',
    cancelledAt: at,
    lastError: options?.error ?? null,
  }
}

export function isTerminalLifecycle(status: BookingExecutionLifecycle): boolean {
  return status === 'confirmed' || status === 'failed' || status === 'cancelled'
}
