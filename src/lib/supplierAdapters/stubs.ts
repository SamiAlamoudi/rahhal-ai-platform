/**
 * Stub adapters for future suppliers — same port, not wired as active defaults.
 */

import type {
  SupplierBookingAdapter,
  SupplierAdapterCapabilities,
  SupplierConfirmRequest,
  SupplierConfirmResult,
  SupplierId,
} from './types'

function stubAdapter(supplierId: SupplierId, displayName: string): SupplierBookingAdapter {
  return {
    supplierId,
    displayName,
    getCapabilities(): SupplierAdapterCapabilities {
      return {
        supplierId,
        displayName,
        supportsFlightConfirmation: false,
        supportsCancellation: false,
        mocked: true,
      }
    },
    async confirmBooking(_request: SupplierConfirmRequest): Promise<SupplierConfirmResult> {
      return {
        success: false,
        supplierId,
        supplierReference: null,
        airlinePnr: null,
        message: `${displayName} confirmation adapter is not implemented yet.`,
      }
    },
  }
}

export const duffelBookingConfirmationStub = stubAdapter('duffel', 'Duffel')
export const travelportBookingConfirmationStub = stubAdapter('travelport', 'Travelport')
export const sabreBookingConfirmationStub = stubAdapter('sabre', 'Sabre')
