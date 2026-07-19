/**
 * Sprint 14 — Supplier booking confirmation ports.
 * Search adapters stay separate; this layer only confirms bookings.
 * Do NOT couple booking confirmation engine to a specific supplier.
 */

export type SupplierId = 'amadeus' | 'duffel' | 'travelport' | 'sabre' | 'mock'

export interface SupplierConfirmRequest {
  sessionId: string
  offerId: string
  bookingPayload: Record<string, unknown> | null
  passengers: Array<Record<string, unknown>>
  currency: string
  amount: number
  /** Existing temporary Rahhal reference. */
  temporaryReference: string
  forceFail?: boolean
}

export interface SupplierConfirmResult {
  success: boolean
  supplierId: SupplierId
  /** Supplier PNR / order id when confirmed. */
  supplierReference: string | null
  /** Optional airline PNR. */
  airlinePnr: string | null
  message: string
  raw?: Record<string, unknown>
}

export interface SupplierAdapterCapabilities {
  supplierId: SupplierId
  displayName: string
  supportsFlightConfirmation: boolean
  supportsCancellation: boolean
  /** True when adapter simulates confirmation (no live Create Orders). */
  mocked: boolean
}

export interface SupplierBookingAdapter {
  readonly supplierId: SupplierId
  readonly displayName: string
  getCapabilities(): SupplierAdapterCapabilities
  confirmBooking(request: SupplierConfirmRequest): Promise<SupplierConfirmResult>
}
