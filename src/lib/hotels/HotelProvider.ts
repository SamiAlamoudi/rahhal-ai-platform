/**
 * Sprint 30 — Generic HotelProvider interface (sandbox-ready foundation).
 */

import type {
  HotelCancellationPolicy,
  HotelPricingRequest,
  HotelProviderCapabilities,
  HotelProviderMetadata,
  HotelProviderResult,
  HotelRoomAvailability,
  HotelRoomAvailabilityRequest,
  HotelSearchRequest,
  HotelTaxesAndFees,
  NormalizedHotelResult,
} from './types'

export interface HotelProvider {
  readonly metadata: HotelProviderMetadata
  getCapabilities(): HotelProviderCapabilities
  isAvailable(): boolean
  searchHotels(req: HotelSearchRequest): Promise<HotelProviderResult<NormalizedHotelResult[]>>
  getRoomAvailability(
    req: HotelRoomAvailabilityRequest,
  ): Promise<HotelProviderResult<HotelRoomAvailability[]>>
  getPricing(
    req: HotelPricingRequest,
  ): Promise<HotelProviderResult<{ nightly: number; total: number; taxesAndFees: HotelTaxesAndFees }>>
  getCancellationPolicy(
    hotelId: string,
    roomId?: string,
  ): Promise<HotelProviderResult<HotelCancellationPolicy>>
}
