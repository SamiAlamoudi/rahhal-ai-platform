/**
 * Sprint 114 — DayPlanner
 * Splits trip into arrival / full / departure days with city assignment.
 */

import type {
  ItineraryCityStay,
  ItineraryDayPlan,
  ItineraryEngineInput,
  TripStyleKind,
} from './types'
import { daysBetween, eachDateInclusive } from './types'

export interface NormalizedItineraryContext {
  destination: string
  departureDate: string
  returnDate: string
  checkInDate: string
  checkOutDate: string
  style: TripStyleKind
  cities: ItineraryCityStay[]
  hotelName: string | null
  flightArrivalMinutes: number | null
  flightDepartureMinutes: number | null
  flightDurationMinutes: number
  arrivalDelayMinutes: number
  interests: string[]
  adults: number
  children: number
}

export function normalizeItineraryContext(
  input: ItineraryEngineInput,
): { ok: true; ctx: NormalizedItineraryContext } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const trip = input.trip
  const destination =
    trip?.destination?.trim()
    || input.destination?.trim()
    || input.cities?.[0]?.city?.trim()
    || ''
  if (!destination) errors.push('destination is required')

  const departureDate =
    trip?.departureDate?.trim()
    || input.departureDate?.trim()
    || ''
  if (!departureDate) errors.push('departureDate is required')

  const returnDate =
    trip?.returnDate?.trim()
    || input.returnDate?.trim()
    || trip?.checkOutDate?.trim()
    || input.checkOutDate?.trim()
    || departureDate

  const checkInDate =
    trip?.checkInDate?.trim()
    || input.checkInDate?.trim()
    || departureDate

  const checkOutDate =
    trip?.checkOutDate?.trim()
    || input.checkOutDate?.trim()
    || returnDate

  if (departureDate && returnDate && returnDate < departureDate) {
    errors.push('returnDate must be on or after departureDate')
  }
  if (checkInDate && checkOutDate && checkOutDate < checkInDate) {
    errors.push('checkOutDate must be on or after checkInDate')
  }

  if (errors.length) return { ok: false, errors }

  let style: TripStyleKind = input.style ?? 'leisure'
  if (!input.style) {
    if ((input.children ?? trip?.hotel ? 0 : 0) > 0) style = 'family'
    // infer from trip labels when present
    const labels = trip?.labels ?? []
    if (labels.includes('best_business')) style = 'business'
    else if (labels.includes('best_family')) style = 'family'
  }
  if ((input.children ?? 0) > 0 && style === 'leisure') style = 'family'

  const hotel = trip?.hotel ?? input.hotels?.[0] ?? null
  const flight = trip?.flight ?? input.flights?.[0] ?? null
  const returnFlight =
    input.flights && input.flights.length > 1
      ? input.flights[input.flights.length - 1]
      : flight

  let cities: ItineraryCityStay[] =
    input.cities?.filter((c) => c.city?.trim()) ?? []
  if (cities.length === 0) {
    cities = [
      {
        city: destination,
        arriveDate: checkInDate,
        departDate: checkOutDate,
        hotel,
      },
    ]
  }

  // Ensure multi-city date coverage
  if (cities.length > 1) {
    cities = cities.map((c) => ({
      ...c,
      city: c.city.trim(),
      arriveDate: c.arriveDate || checkInDate,
      departDate: c.departDate || checkOutDate,
    }))
  }

  return {
    ok: true,
    ctx: {
      destination,
      departureDate,
      returnDate,
      checkInDate,
      checkOutDate,
      style,
      cities,
      hotelName: hotel?.hotelName ?? null,
      flightArrivalMinutes: (() => {
        const raw = flight?.arrivalAt ?? null
        if (!raw) return 14 * 60
        const m = raw.match(/T(\d{2}):(\d{2})/)
        return m ? Number(m[1]) * 60 + Number(m[2]) : 14 * 60
      })(),
      flightDepartureMinutes: (() => {
        const raw = returnFlight?.departureAt ?? flight?.departureAt ?? null
        if (!raw) return 18 * 60
        const m = raw.match(/T(\d{2}):(\d{2})/)
        // outbound departure used only for arrival day; return departure for last day
        return m ? Number(m[1]) * 60 + Number(m[2]) : 18 * 60
      })(),
      flightDurationMinutes: flight?.durationMinutes ?? 0,
      arrivalDelayMinutes: Math.max(0, input.arrivalDelayMinutes ?? 0),
      interests: (input.interests ?? []).map((i) => i.trim()).filter(Boolean),
      adults: input.adults ?? 1,
      children: input.children ?? 0,
    },
  }
}

function cityForDate(cities: ItineraryCityStay[], date: string): ItineraryCityStay {
  for (const c of cities) {
    if (date >= c.arriveDate && date <= c.departDate) return c
  }
  return cities[cities.length - 1] ?? {
    city: 'Unknown',
    arriveDate: date,
    departDate: date,
  }
}

export function planDays(ctx: NormalizedItineraryContext): ItineraryDayPlan[] {
  const dates = eachDateInclusive(ctx.departureDate, ctx.returnDate)
  // Ensure at least one day
  const list = dates.length > 0 ? dates : [ctx.departureDate]
  const last = list[list.length - 1]!

  return list.map((date, dayIndex) => {
    const cityStay = cityForDate(ctx.cities, date)
    const isArrivalDay = dayIndex === 0
    const isDepartureDay = date === last
    let label = `Day ${dayIndex + 1} in ${cityStay.city}`
    if (isArrivalDay && isDepartureDay) label = `Day trip in ${cityStay.city}`
    else if (isArrivalDay) label = `Arrival day in ${cityStay.city}`
    else if (isDepartureDay) label = `Departure day from ${cityStay.city}`

    return {
      date,
      dayIndex,
      city: cityStay.city,
      label,
      isArrivalDay,
      isDepartureDay,
      blocks: [],
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
      freeMinutes: 0,
      walkingMinutes: 0,
      transferMinutes: 0,
    }
  })
}

export function hotelNights(ctx: NormalizedItineraryContext): number {
  return Math.max(0, daysBetween(ctx.checkInDate, ctx.checkOutDate))
}

export class DayPlanner {
  normalize(input: ItineraryEngineInput) {
    return normalizeItineraryContext(input)
  }

  plan(ctx: NormalizedItineraryContext): ItineraryDayPlan[] {
    return planDays(ctx)
  }
}

export function createDayPlanner(): DayPlanner {
  return new DayPlanner()
}
