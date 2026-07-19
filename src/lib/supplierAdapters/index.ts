export type {
  SupplierId,
  SupplierConfirmRequest,
  SupplierConfirmResult,
  SupplierAdapterCapabilities,
  SupplierBookingAdapter,
} from './types'
export {
  registerSupplierAdapter,
  getSupplierAdapter,
  listSupplierAdapters,
  resetSupplierAdapterRegistry,
} from './registry'
export {
  AmadeusBookingConfirmationAdapter,
  createAmadeusBookingConfirmationAdapter,
} from './amadeus/amadeusBookingConfirmationAdapter'
export {
  duffelBookingConfirmationStub,
  travelportBookingConfirmationStub,
  sabreBookingConfirmationStub,
} from './stubs'
