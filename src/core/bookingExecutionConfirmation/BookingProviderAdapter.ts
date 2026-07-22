/**
 * Sprint 102 — abstract Booking Provider Adapter.
 * No provider-specific implementation lives here.
 */

import type {
  AbstractBookRequest,
  AbstractBookResult,
  AbstractCancelRequest,
  AbstractCancelResult,
} from './types'

/**
 * Provider-agnostic booking adapter contract.
 * Concrete live adapters (Amadeus, etc.) are out of scope for this sprint.
 */
export interface BookingProviderAdapter {
  readonly id: string
  readonly kind: 'abstract'
  book(request: AbstractBookRequest): Promise<AbstractBookResult>
  cancel?(request: AbstractCancelRequest): Promise<AbstractCancelResult>
}

/**
 * In-memory stub adapter for demos/tests.
 * Not a real supplier — returns placeholder references only.
 */
export class StubBookingProviderAdapter implements BookingProviderAdapter {
  readonly id = 'stub-booking-adapter'
  readonly kind = 'abstract' as const
  private readonly forceFail: boolean

  constructor(options?: { forceFail?: boolean }) {
    this.forceFail = options?.forceFail === true
  }

  async book(request: AbstractBookRequest): Promise<AbstractBookResult> {
    if (this.forceFail) {
      return {
        ok: false,
        bookingReference: null,
        pnrPlaceholder: null,
        lifecycle: 'failed',
        error: 'Stub adapter forced failure.',
      }
    }
    const suffix = request.bookingId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()
      || Math.random().toString(36).slice(2, 8).toUpperCase()
    return {
      ok: true,
      bookingReference: `RHL-BK-${suffix}`,
      pnrPlaceholder: `PNR-PENDING-${suffix}`,
      lifecycle: 'confirmed',
      error: null,
      raw: { adapter: this.id, abstract: true },
    }
  }

  async cancel(request: AbstractCancelRequest): Promise<AbstractCancelResult> {
    if (!request.bookingId) {
      return { ok: false, lifecycle: 'failed', error: 'Missing booking id.' }
    }
    return { ok: true, lifecycle: 'cancelled', error: null }
  }
}

export function createStubBookingProviderAdapter(
  options?: { forceFail?: boolean },
): BookingProviderAdapter {
  return new StubBookingProviderAdapter(options)
}
