/**
 * Payment events + audit — Sprint 58.
 */

import type {
  PaymentAuditEntry,
  PaymentEventType,
  PaymentLifecycleStatus,
  PaymentNotificationEvent,
} from './types'

export type PaymentEventListener = (event: PaymentNotificationEvent) => void

export class PaymentEventBus {
  private readonly listeners = new Map<PaymentEventType | '*', Set<PaymentEventListener>>()

  on(type: PaymentEventType | '*', listener: PaymentEventListener): () => void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
    return () => {
      set.delete(listener)
    }
  }

  emit(event: PaymentNotificationEvent): void {
    const specific = this.listeners.get(event.type)
    if (specific) for (const l of specific) l(event)
    const all = this.listeners.get('*')
    if (all) for (const l of all) l(event)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export function createPaymentPlatformEvent(
  type: PaymentEventType,
  sessionId: string,
  data?: Record<string, unknown>,
  now: () => number = () => Date.now(),
): PaymentNotificationEvent {
  return { type, sessionId, at: new Date(now()).toISOString(), data }
}

export class PaymentAuditTrail {
  private readonly entries: PaymentAuditEntry[] = []

  record(input: {
    sessionId: string
    action: string
    provider?: string | null
    latencyMs?: number | null
    error?: string | null
    fromStatus?: PaymentLifecycleStatus | null
    toStatus?: PaymentLifecycleStatus | null
    detail?: Record<string, unknown>
    now?: () => number
  }): PaymentAuditEntry {
    const now = input.now ?? (() => Date.now())
    const entry: PaymentAuditEntry = {
      id: `paud_${Math.random().toString(36).slice(2, 10)}`,
      sessionId: input.sessionId,
      at: new Date(now()).toISOString(),
      action: input.action,
      provider: input.provider ?? null,
      latencyMs: input.latencyMs ?? null,
      error: input.error ?? null,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      detail: input.detail,
    }
    this.entries.push(entry)
    return entry
  }

  list(sessionId?: string): PaymentAuditEntry[] {
    if (!sessionId) return [...this.entries]
    return this.entries.filter((e) => e.sessionId === sessionId)
  }

  hydrate(entries: PaymentAuditEntry[]): void {
    this.entries.length = 0
    this.entries.push(...entries)
  }

  clear(): void {
    this.entries.length = 0
  }
}
