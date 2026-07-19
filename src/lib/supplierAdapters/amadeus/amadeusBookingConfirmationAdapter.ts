/**
 * Amadeus supplier adapter for booking confirmation.
 * Foundation only — does not call live Create Orders yet.
 * Deterministic mock confirmation keeps CI/offline green while the port is real.
 */

import type {
  SupplierBookingAdapter,
  SupplierAdapterCapabilities,
  SupplierConfirmRequest,
  SupplierConfirmResult,
} from '../types'

function buildSupplierRef(sessionId: string): string {
  const compact = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()
  return `AMA-${compact || 'ORDER'}`
}

export class AmadeusBookingConfirmationAdapter implements SupplierBookingAdapter {
  readonly supplierId = 'amadeus' as const
  readonly displayName = 'Amadeus'

  getCapabilities(): SupplierAdapterCapabilities {
    return {
      supplierId: 'amadeus',
      displayName: 'Amadeus',
      supportsFlightConfirmation: true,
      supportsCancellation: false,
      mocked: true,
    }
  }

  async confirmBooking(request: SupplierConfirmRequest): Promise<SupplierConfirmResult> {
    if (request.forceFail) {
      return {
        success: false,
        supplierId: 'amadeus',
        supplierReference: null,
        airlinePnr: null,
        message: 'Amadeus confirmation failed (forced).',
      }
    }

    // Live Create Orders will replace this mock path behind the same interface.
    const supplierReference = buildSupplierRef(request.sessionId)
    return {
      success: true,
      supplierId: 'amadeus',
      supplierReference,
      airlinePnr: `PNR${supplierReference.slice(-4)}`,
      message: 'Amadeus order confirmed (adapter foundation).',
      raw: {
        kind: 'amadeus_confirmation_mock',
        offerId: request.offerId,
        temporaryReference: request.temporaryReference,
      },
    }
  }
}

export function createAmadeusBookingConfirmationAdapter(): SupplierBookingAdapter {
  return new AmadeusBookingConfirmationAdapter()
}
