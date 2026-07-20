/**
 * Build BookedServiceLine[] from a unified plan or demo basket for conversation quotes.
 */

import type { UnifiedTravelPlanOption } from '../../brain/unifiedTravel/types'
import type { BookedServiceLine } from '../types'

export function linesFromPlan(
  plan: UnifiedTravelPlanOption | null | undefined,
  currency = 'SAR',
): BookedServiceLine[] {
  if (!plan) return demoBasket(currency)
  const lines: BookedServiceLine[] = []
  if (plan.flight) {
    lines.push({
      lineId: 'flight_1',
      serviceKind: 'flight',
      title: 'Flight',
      amountPaid: plan.flight.price,
      currency: plan.flight.currency || currency,
      quantity: 2,
      providerId: plan.flight.providerId,
      rawPolicy: {
        providerId: plan.flight.providerId,
        partiallyRefundable: true,
        partialRefundPercent: 85,
        airlinePenalty: 350,
        airportTaxesRefundable: 180,
        serviceFee: 40,
        refundDaysMin: 5,
        refundDaysMax: 7,
      },
    })
  }
  if (plan.hotel) {
    lines.push({
      lineId: 'hotel_1',
      serviceKind: 'hotel',
      title: 'Hotel',
      amountPaid: plan.hotel.stayTotal,
      currency: plan.hotel.currency || currency,
      quantity: 1,
      providerId: String(plan.hotel.providerId),
      rawPolicy: {
        providerId: plan.hotel.providerId,
        freeCancellation: plan.hotel.freeCancellation,
        deadline: plan.hotel.freeCancellation
          ? new Date(Date.now() + 86400000 * 2).toISOString()
          : null,
        nightly: plan.hotel.nightly,
        summary: plan.hotel.freeCancellation
          ? 'Free cancellation before deadline'
          : 'Non-refundable rate',
        nonRefundable: !plan.hotel.freeCancellation,
      },
      metadata: { nightly: plan.hotel.nightly },
    })
  }
  if (!lines.length) return demoBasket(currency)
  return lines
}

/** Example basket matching Sprint 36 refund breakdown sample. */
export function demoBasket(currency = 'SAR'): BookedServiceLine[] {
  return [
    {
      lineId: 'flight_1',
      serviceKind: 'flight',
      title: 'Flight',
      amountPaid: 2400,
      currency,
      quantity: 2,
      providerId: 'mock-flight-001',
      rawPolicy: {
        providerId: 'mock-flight-001',
        partiallyRefundable: true,
        partialRefundPercent: 85,
        airlinePenalty: 350,
        airportTaxesRefundable: 180,
        serviceFee: 40,
        refundDaysMin: 5,
        refundDaysMax: 7,
      },
    },
    {
      lineId: 'hotel_1',
      serviceKind: 'hotel',
      title: 'Hotel',
      amountPaid: 1600,
      currency,
      quantity: 1,
      providerId: 'hotelbeds',
      rawPolicy: {
        providerId: 'hotelbeds',
        freeCancellation: true,
        deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
        nightly: 400,
        summary: 'Free cancellation',
      },
      metadata: { nightly: 400 },
    },
    {
      lineId: 'car_1',
      serviceKind: 'car_rental',
      title: 'Car',
      amountPaid: 600,
      currency,
      quantity: 1,
      providerId: 'car_generic',
      rawPolicy: {
        providerId: 'car_generic',
        freeCancellation: true,
        pickupDeadlineHours: 24,
        insuranceRefundable: false,
        depositRefundable: true,
        oneWayFeeNonRefundable: true,
        refundDaysMin: 5,
        refundDaysMax: 7,
      },
      metadata: { insurance: 60, deposit: 200, oneWayFee: 0 },
    },
  ]
}
