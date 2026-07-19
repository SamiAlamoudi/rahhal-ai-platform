/**
 * Supplier adapter registry — swap providers without changing confirmation engine.
 */

import type { SupplierBookingAdapter, SupplierId } from './types'
import { createAmadeusBookingConfirmationAdapter } from './amadeus/amadeusBookingConfirmationAdapter'
import {
  duffelBookingConfirmationStub,
  sabreBookingConfirmationStub,
  travelportBookingConfirmationStub,
} from './stubs'

const adapters = new Map<SupplierId, SupplierBookingAdapter>()

function ensureDefaults(): void {
  if (adapters.size > 0) return
  adapters.set('amadeus', createAmadeusBookingConfirmationAdapter())
  adapters.set('duffel', duffelBookingConfirmationStub)
  adapters.set('travelport', travelportBookingConfirmationStub)
  adapters.set('sabre', sabreBookingConfirmationStub)
}

export function registerSupplierAdapter(adapter: SupplierBookingAdapter): void {
  ensureDefaults()
  adapters.set(adapter.supplierId, adapter)
}

export function getSupplierAdapter(supplierId: SupplierId = 'amadeus'): SupplierBookingAdapter {
  ensureDefaults()
  const found = adapters.get(supplierId)
  if (found) return found
  return adapters.get('amadeus')!
}

export function listSupplierAdapters(): SupplierBookingAdapter[] {
  ensureDefaults()
  return Array.from(adapters.values())
}

/** Test helper. */
export function resetSupplierAdapterRegistry(): void {
  adapters.clear()
}
