/**
 * Sprint 94 — reservation plan from a bookable Trip.
 */

import type { BookableTrip, BookingPlan, BookingPlanStep } from './types'

export function createBookingPlan(input: {
  trip: BookableTrip
  providerId?: string
  now?: () => number
}): BookingPlan {
  const now = input.now ?? Date.now
  const providerId = input.providerId ?? 'booking-orchestrator'
  const currency = input.trip.currency || 'SAR'
  const steps: BookingPlanStep[] = []
  let order = 0

  for (const flight of input.trip.flights ?? []) {
    steps.push({
      id: `step_flight_${flight.id}`,
      kind: 'flight',
      offerId: flight.id,
      title: flight.airline ? `${flight.airline} ${flight.origin}→${flight.destination}` : `Flight ${flight.origin}→${flight.destination}`,
      amount: flight.price,
      currency: flight.currency || currency,
      providerId: flight.providerId ?? providerId,
      placeholder: false,
      order: order++,
    })
  }

  if (input.trip.hotel) {
    const hotel = input.trip.hotel
    steps.push({
      id: `step_hotel_${hotel.id}`,
      kind: 'hotel',
      offerId: hotel.id,
      title: hotel.name,
      amount: hotel.price,
      currency: hotel.currency || currency,
      providerId: hotel.providerId ?? 'placeholder',
      placeholder: true, // hotel live booking out of scope this sprint
      order: order++,
    })
  } else {
    steps.push({
      id: 'step_hotel_placeholder',
      kind: 'hotel',
      offerId: 'hotel_placeholder',
      title: 'Hotel reservation (placeholder)',
      amount: 0,
      currency,
      providerId: 'placeholder',
      placeholder: true,
      order: order++,
    })
  }

  const transfers = input.trip.transfers ?? []
  if (transfers.length === 0) {
    steps.push({
      id: 'step_transfer_placeholder',
      kind: 'transfer',
      offerId: 'transfer_placeholder',
      title: 'Transfer reservation (placeholder)',
      amount: 0,
      currency,
      providerId: 'placeholder',
      placeholder: true,
      order: order++,
    })
  } else {
    for (const transfer of transfers) {
      steps.push({
        id: `step_transfer_${transfer.id}`,
        kind: 'transfer',
        offerId: transfer.id,
        title: transfer.title,
        amount: transfer.price,
        currency: transfer.currency || currency,
        providerId: transfer.providerId ?? 'placeholder',
        placeholder: true,
        order: order++,
      })
    }
  }

  if (input.trip.insurance) {
    const ins = input.trip.insurance
    steps.push({
      id: `step_insurance_${ins.id}`,
      kind: 'insurance',
      offerId: ins.id,
      title: ins.title,
      amount: ins.price,
      currency: ins.currency || currency,
      providerId: ins.providerId ?? 'placeholder',
      placeholder: true,
      order: order++,
    })
  } else {
    steps.push({
      id: 'step_insurance_placeholder',
      kind: 'insurance',
      offerId: 'insurance_placeholder',
      title: 'Insurance reservation (placeholder)',
      amount: 0,
      currency,
      providerId: 'placeholder',
      placeholder: true,
      order: order++,
    })
  }

  const totalAmount = Math.round(
    steps.reduce((sum, s) => sum + (Number.isFinite(s.amount) ? s.amount : 0), 0) * 100,
  ) / 100

  return {
    id: `plan_${input.trip.id}_${now().toString(36)}`,
    tripId: input.trip.id,
    currency,
    totalAmount,
    steps,
    createdAt: new Date(now()).toISOString(),
  }
}
