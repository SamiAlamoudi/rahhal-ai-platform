/**
 * Sprint 31 — Generate day-by-day itinerary sketches for a matched plan.
 */

import type {
  UnifiedFlightLeg,
  UnifiedHotelStay,
  UnifiedItineraryDay,
  UnifiedTravelPlannerContext,
} from './types'

export function buildUnifiedItinerary(input: {
  ctx: UnifiedTravelPlannerContext
  flight: UnifiedFlightLeg | null
  hotel: UnifiedHotelStay | null
}): UnifiedItineraryDay[] {
  const nights = Math.max(1, input.ctx.nights)
  const dest = input.ctx.destination || input.flight?.to || 'Destination'
  const origin = input.ctx.origin || input.flight?.from || 'Origin'
  const hotelName = input.hotel?.name || `${dest} hotel`
  const days: UnifiedItineraryDay[] = []

  days.push({
    day: 1,
    date: input.ctx.startDate,
    title: input.ctx.locale === 'ar' ? 'الوصول' : 'Arrival',
    summary:
      input.ctx.locale === 'ar'
        ? `السفر من ${origin} إلى ${dest} وتسجيل الوصول في ${hotelName}`
        : `Fly ${origin} → ${dest} and check in at ${hotelName}`,
    items: [
      input.flight
        ? `${input.flight.airline} ${input.flight.from}→${input.flight.to}`
        : `Depart ${origin}`,
      `Check-in: ${hotelName}`,
      ...(input.ctx.activities.slice(0, 1).map((a) => `Evening: ${a}`)),
    ],
  })

  for (let d = 2; d <= nights; d++) {
    const activity =
      input.ctx.activities[(d - 2) % Math.max(1, input.ctx.activities.length)]
      || (d % 2 === 0 ? 'city highlights' : 'local dining')
    days.push({
      day: d,
      date: input.ctx.startDate ? addDays(input.ctx.startDate, d - 1) : null,
      title: input.ctx.locale === 'ar' ? `اليوم ${d}` : `Day ${d}`,
      summary:
        input.ctx.locale === 'ar'
          ? `استكشاف ${dest} — ${activity}`
          : `Explore ${dest} — ${activity}`,
      items: [
        `Morning: ${activity}`,
        `Stay: ${hotelName}`,
        input.hotel?.amenities[0]
          ? `Hotel amenity: ${input.hotel.amenities[0]}`
          : 'Free time / flexible plans',
      ],
    })
  }

  days.push({
    day: nights + 1,
    date: input.ctx.endDate,
    title: input.ctx.locale === 'ar' ? 'المغادرة' : 'Departure',
    summary:
      input.ctx.locale === 'ar'
        ? `مغادرة ${dest} والعودة إلى ${origin}`
        : `Depart ${dest} and return to ${origin}`,
    items: [
      `Check-out: ${hotelName}`,
      input.flight
        ? `Return / onward via ${input.flight.airline}`
        : `Return to ${origin}`,
    ],
  })

  return days
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
