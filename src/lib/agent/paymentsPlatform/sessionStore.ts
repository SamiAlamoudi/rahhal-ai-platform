/**
 * Payment session persistence — Sprint 58.
 */

import type { PaymentSession } from './types'

export class PaymentSessionStore {
  private readonly sessions = new Map<string, PaymentSession>()
  private readonly byIdempotency = new Map<string, string>()

  save(session: PaymentSession): void {
    this.sessions.set(session.id, structuredClone(session))
    this.byIdempotency.set(session.idempotencyKey, session.id)
  }

  get(id: string): PaymentSession | undefined {
    const s = this.sessions.get(id)
    return s ? structuredClone(s) : undefined
  }

  getByIdempotencyKey(key: string): PaymentSession | undefined {
    const id = this.byIdempotency.get(key)
    return id ? this.get(id) : undefined
  }

  list(): PaymentSession[] {
    return [...this.sessions.values()].map((s) => structuredClone(s))
  }

  persist(): PaymentSession[] {
    return this.list()
  }

  recover(sessions: PaymentSession[]): void {
    this.sessions.clear()
    this.byIdempotency.clear()
    for (const session of sessions) {
      this.sessions.set(session.id, structuredClone(session))
      this.byIdempotency.set(session.idempotencyKey, session.id)
    }
  }

  clear(): void {
    this.sessions.clear()
    this.byIdempotency.clear()
  }
}

let defaultStore: PaymentSessionStore | null = null

export function getDefaultPaymentSessionStore(): PaymentSessionStore {
  if (!defaultStore) defaultStore = new PaymentSessionStore()
  return defaultStore
}

export function resetDefaultPaymentSessionStore(): void {
  defaultStore?.clear()
  defaultStore = null
}
