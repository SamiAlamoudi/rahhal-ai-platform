/**
 * Integration Sprint 4 — structured trip itinerary skeleton (consultant-facing).
 */

import type { TripRequirements } from '../types'
import type { OrchestratorItinerary } from './types'

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return iso
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function buildOrchestratorItinerary(input: {
  requirements: TripRequirements
  flight: Record<string, unknown> | null
  hotel: Record<string, unknown> | null
}): OrchestratorItinerary {
  const req = input.requirements
  const destination = req.destination ?? req.destinations[0] ?? 'Destination'
  const start = req.startDate ?? null
  const duration = Math.max(2, req.durationDays ?? 4)
  const end = req.endDate ?? (start ? addDays(start, duration) : null)
  const hotelName = input.hotel
    ? String(input.hotel.name ?? input.hotel.hotelName ?? 'Hotel')
    : null
  const airline = input.flight
    ? String(input.flight.airline ?? 'Flight')
    : null

  const days = []
  for (let i = 0; i < duration; i += 1) {
    const dayNum = i + 1
    if (i === 0) {
      days.push({
        day: dayNum,
        title: `Arrival · ${destination}`,
        location: destination,
        items: [
          airline ? `Arrive on ${airline}` : 'Arrive and transfer',
          hotelName ? `Check-in at ${hotelName}` : 'Hotel check-in',
          'Light evening walk / dinner near the hotel',
        ],
      })
    } else if (i === duration - 1) {
      days.push({
        day: dayNum,
        title: `Departure · ${destination}`,
        location: destination,
        items: [
          hotelName ? `Check-out from ${hotelName}` : 'Hotel check-out',
          'Airport transfer',
          airline ? `Return flight (${airline})` : 'Return flight',
        ],
      })
    } else {
      days.push({
        day: dayNum,
        title: `Explore · ${destination}`,
        location: destination,
        items: [
          'Morning highlight / landmark',
          'Lunch in a recommended area',
          'Afternoon museum / souq / nature',
          'Evening free time',
        ],
      })
    }
  }

  return {
    departure: start,
    arrival: start,
    hotel: hotelName,
    checkIn: start,
    checkOut: end,
    returnDate: end,
    days,
  }
}
