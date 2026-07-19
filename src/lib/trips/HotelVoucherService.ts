/**
 * Sprint 35 — HotelVoucherService (document generation; reuses confirmation numbers).
 */

import type { CreatePostBookingTripInput, HotelVoucherDoc } from './postBookingTypes'

export class HotelVoucherService {
  generate(input: CreatePostBookingTripInput, tripId: string): HotelVoucherDoc | null {
    if (!input.references.hotelConfirmation) return null
    const voucherId = `voucher_${Math.random().toString(36).slice(2, 10)}`
    const hotelName = input.hotelName ?? 'Hotel stay'
    return {
      voucherId,
      tripId,
      hotelName,
      confirmationNumber: input.references.hotelConfirmation,
      checkIn: input.startDate ?? null,
      checkOut: input.endDate ?? null,
      guests: Math.max(1, input.travelers ?? 1),
      pdfUri: `rahhal://documents/hotel-voucher/${voucherId}.pdf`,
      generatedAt: new Date().toISOString(),
    }
  }
}

export function createHotelVoucherService(): HotelVoucherService {
  return new HotelVoucherService()
}
