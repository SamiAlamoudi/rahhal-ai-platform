/**
 * Sprint 34 — Payment event bus.
 */

export type PaymentEventType =
  | 'PaymentIntentCreated'
  | 'InventoryReserved'
  | 'PaymentStarted'
  | 'PaymentSucceeded'
  | 'PaymentFailed'
  | 'BookingConfirmed'
  | 'InvoiceGenerated'
  | 'RefundStarted'
  | 'RefundCompleted'
  | 'RollbackStarted'
  | 'RollbackCompleted'
  | 'CheckoutCompleted'

export interface PaymentEvent {
  type: PaymentEventType
  at: string
  sessionId: string
  data?: Record<string, unknown>
}

export type PaymentEventListener = (event: PaymentEvent) => void

export class PaymentEvents {
  private readonly listeners = new Map<PaymentEventType | '*', Set<PaymentEventListener>>()

  on(type: PaymentEventType | '*', listener: PaymentEventListener): () => void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
    return () => {
      set.delete(listener)
    }
  }

  emit(event: PaymentEvent): void {
    const specific = this.listeners.get(event.type)
    if (specific) for (const l of specific) l(event)
    const all = this.listeners.get('*')
    if (all) for (const l of all) l(event)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export function createPaymentEvent(
  type: PaymentEventType,
  sessionId: string,
  data?: Record<string, unknown>,
): PaymentEvent {
  return {
    type,
    at: new Date().toISOString(),
    sessionId,
    data,
  }
}
