/**
 * Sprint 14 — Booking Confirmation domain (provider-independent).
 * BookingSession remains the source of truth; confirmation state is projected + synced.
 */

export type ConfirmationStatus =
  | 'pending'
  | 'confirming'
  | 'confirmed'
  | 'failed'
  | 'cancelled'

export type ConfirmationEventType =
  | 'booking_created'
  | 'waiting_for_supplier'
  | 'confirming'
  | 'supplier_confirmed'
  | 'confirmation_failed'
  | 'ticket_pending'
  | 'completed'
  | 'cancelled'

export interface ConfirmationEvent {
  id: string
  type: ConfirmationEventType
  at: string
  labelEn: string
  labelAr: string
  meta?: Record<string, unknown>
}

export interface ConfirmationState {
  status: ConfirmationStatus
  /** Production-ready confirmation reference (RHL-CONF-* or supplier PNR). */
  confirmationReference: string
  sessionId: string
  supplierId: string | null
  supplierReference: string | null
  events: ConfirmationEvent[]
  pendingAt: string | null
  confirmingAt: string | null
  confirmedAt: string | null
  failedAt: string | null
  cancelledAt: string | null
  lastError: string | null
  /** Reserved for Sprint 15+ ticket issuance. */
  ticketPending: boolean
}

export interface ConfirmBookingInput {
  sessionId: string
  userId: string
  /** Preferred supplier adapter id (default: amadeus). */
  supplierId?: string
  /** Force adapter failure (tests). */
  forceFail?: boolean
  locale?: 'ar' | 'en'
}

export interface ConfirmBookingResult {
  ok: boolean
  state: ConfirmationState
  sessionId: string
  error: string | null
}
