/**
 * Sprint 34 — in-memory PaymentSession store.
 */

import { PaymentPlatformError } from './PaymentErrors'
import type { PlatformPaymentSession, PlatformPaymentSessionState } from './types'

export class PaymentSessionStore {
  private readonly sessions = new Map<string, PlatformPaymentSession>()
  private readonly byIdempotency = new Map<string, string>()
  private readonly paidIntents = new Set<string>()

  create(session: PlatformPaymentSession): PlatformPaymentSession {
    this.sessions.set(session.sessionId, clone(session))
    this.byIdempotency.set(session.intent.idempotencyKey, session.sessionId)
    return clone(session)
  }

  get(sessionId: string): PlatformPaymentSession {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new PaymentPlatformError('SESSION_NOT_FOUND', `Payment session ${sessionId} not found`)
    }
    return clone(session)
  }

  findByIdempotencyKey(key: string): PlatformPaymentSession | null {
    const id = this.byIdempotency.get(key)
    if (!id) return null
    const session = this.sessions.get(id)
    return session ? clone(session) : null
  }

  update(
    sessionId: string,
    patch: Partial<PlatformPaymentSession> & { state?: PlatformPaymentSessionState },
  ): PlatformPaymentSession {
    const current = this.sessions.get(sessionId)
    if (!current) {
      throw new PaymentPlatformError('SESSION_NOT_FOUND', `Payment session ${sessionId} not found`)
    }
    const next: PlatformPaymentSession = {
      ...current,
      ...patch,
      intent: patch.intent ? { ...patch.intent } : current.intent,
      inventory: patch.inventory === undefined
        ? current.inventory
        : patch.inventory
          ? { ...patch.inventory }
          : null,
      pricing: patch.pricing ? { ...patch.pricing } : current.pricing,
      bookingRefs: patch.bookingRefs === undefined
        ? current.bookingRefs
        : patch.bookingRefs
          ? { ...patch.bookingRefs, confirmationNumbers: { ...patch.bookingRefs.confirmationNumbers } }
          : null,
      refundIds: patch.refundIds ? [...patch.refundIds] : [...current.refundIds],
      warnings: patch.warnings ? [...patch.warnings] : [...current.warnings],
      metadata: patch.metadata ? { ...patch.metadata } : { ...current.metadata },
      updatedAt: new Date().toISOString(),
    }
    this.sessions.set(sessionId, next)
    if (next.state === 'PAID' || next.state === 'COMPLETED') {
      this.paidIntents.add(next.intent.intentId)
    }
    return clone(next)
  }

  isIntentPaid(intentId: string): boolean {
    return this.paidIntents.has(intentId)
  }

  list(): PlatformPaymentSession[] {
    return [...this.sessions.values()].map(clone)
  }

  clear(): void {
    this.sessions.clear()
    this.byIdempotency.clear()
    this.paidIntents.clear()
  }
}

function clone(session: PlatformPaymentSession): PlatformPaymentSession {
  return {
    ...session,
    intent: { ...session.intent },
    inventory: session.inventory ? { ...session.inventory } : null,
    pricing: { ...session.pricing },
    bookingRefs: session.bookingRefs
      ? {
          ...session.bookingRefs,
          confirmationNumbers: { ...session.bookingRefs.confirmationNumbers },
        }
      : null,
    refundIds: [...session.refundIds],
    warnings: [...session.warnings],
    metadata: { ...session.metadata },
  }
}

let sharedStore: PaymentSessionStore | null = null

export function getPaymentSessionStore(): PaymentSessionStore {
  if (!sharedStore) sharedStore = new PaymentSessionStore()
  return sharedStore
}

export function resetPaymentSessionStore(): void {
  sharedStore?.clear()
  sharedStore = null
}
