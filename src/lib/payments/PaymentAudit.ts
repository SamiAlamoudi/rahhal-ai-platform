/**
 * Sprint 34 — Payment audit log.
 */

import type { PlatformPaymentSessionState } from './types'

export interface PaymentAuditEntry {
  id: string
  at: string
  sessionId: string
  action: string
  state: PlatformPaymentSessionState
  detail: Record<string, unknown>
}

export class PaymentAudit {
  private readonly entries: PaymentAuditEntry[] = []

  record(
    sessionId: string,
    action: string,
    state: PlatformPaymentSessionState,
    detail: Record<string, unknown> = {},
  ): PaymentAuditEntry {
    const entry: PaymentAuditEntry = {
      id: `paud_${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      sessionId,
      action,
      state,
      detail,
    }
    this.entries.push(entry)
    return entry
  }

  list(sessionId?: string): PaymentAuditEntry[] {
    if (!sessionId) return [...this.entries]
    return this.entries.filter((e) => e.sessionId === sessionId)
  }

  clear(): void {
    this.entries.length = 0
  }
}
