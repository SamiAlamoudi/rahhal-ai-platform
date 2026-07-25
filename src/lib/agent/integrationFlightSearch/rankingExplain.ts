/**
 * Integration Sprint 2 — rank flights + explain WHY (consultant language).
 */

import { departureHourUtc, windowFromHour } from './timezone'
import type {
  DepartureTimeWindow,
  FlightRankReason,
  RankedConversationFlight,
} from './types'

export type ConversationRankPrefs = {
  preferredAirline?: string | null
  preferredDepartureTime?: DepartureTimeWindow | null
  maxPrice?: number | null
  preferNonStop?: boolean
}

type RankableFlight = {
  id: string
  providerId: string
  airline: string | null
  flightNumber?: string | null
  origin: string
  destination: string
  departureAt: string | null
  arrivalAt: string | null
  durationMinutes: number | null
  stops: number | null
  cabin: string | null
  fareFamily?: string | null
  price: number | null
  currency: string
  baggage?: string | null
  refundable: boolean
}

function convenienceScore(
  flight: RankableFlight,
  prefs: ConversationRankPrefs,
): number {
  const stops = flight.stops ?? 2
  let score = stops <= 0 ? 1 : stops === 1 ? 0.65 : 0.3
  const hour = departureHourUtc(flight.departureAt)
  if (hour != null && prefs.preferredDepartureTime) {
    score = (score + (windowFromHour(hour) === prefs.preferredDepartureTime ? 1 : 0.35)) / 2
  }
  if (flight.refundable) score = Math.min(1, score + 0.08)
  if (flight.baggage) score = Math.min(1, score + 0.05)
  return score
}

function buildReasons(
  flight: RankableFlight,
  prefs: ConversationRankPrefs,
  cohort: { minPrice: number; maxPrice: number; minDuration: number; maxDuration: number },
): FlightRankReason[] {
  const reasons: FlightRankReason[] = []
  const price = flight.price ?? cohort.maxPrice
  if (price <= cohort.minPrice + (cohort.maxPrice - cohort.minPrice) * 0.25) {
    reasons.push({
      code: 'price',
      labelAr: 'سعر مناسب ضمن الخيارات',
      labelEn: 'Competitive price among options',
      weight: 0.3,
    })
  }
  const duration = flight.durationMinutes ?? cohort.maxDuration
  if (duration <= cohort.minDuration + (cohort.maxDuration - cohort.minDuration) * 0.3) {
    reasons.push({
      code: 'duration',
      labelAr: 'مدة رحلة قصيرة نسبياً',
      labelEn: 'Relatively short travel time',
      weight: 0.2,
    })
  }
  if ((flight.stops ?? 0) === 0) {
    reasons.push({
      code: 'stops',
      labelAr: 'مباشرة بدون توقف',
      labelEn: 'Non-stop flight',
      weight: 0.2,
    })
  } else if ((flight.stops ?? 0) === 1) {
    reasons.push({
      code: 'stops',
      labelAr: 'توقف واحد فقط',
      labelEn: 'Only one stop',
      weight: 0.12,
    })
  }
  const hour = departureHourUtc(flight.departureAt)
  if (hour != null && prefs.preferredDepartureTime && windowFromHour(hour) === prefs.preferredDepartureTime) {
    reasons.push({
      code: 'convenience',
      labelAr: 'وقت إقلاع يناسب تفضيلك',
      labelEn: 'Departure time matches your preference',
      weight: 0.15,
    })
  } else if ((flight.stops ?? 2) === 0 && flight.refundable) {
    reasons.push({
      code: 'convenience',
      labelAr: 'مريحة ومرنة للإلغاء',
      labelEn: 'Convenient and flexible',
      weight: 0.1,
    })
  }
  const preferred = (prefs.preferredAirline ?? '').trim().toLowerCase()
  if (preferred && (flight.airline ?? '').toLowerCase().includes(preferred)) {
    reasons.push({
      code: 'preferred_airline',
      labelAr: 'شركة الطيران المفضلة لديك',
      labelEn: 'Matches your preferred airline',
      weight: 0.15,
    })
  }
  if (flight.refundable) {
    reasons.push({
      code: 'refundable',
      labelAr: 'قابل للاسترداد',
      labelEn: 'Refundable fare',
      weight: 0.08,
    })
  }
  if (flight.baggage) {
    reasons.push({
      code: 'baggage',
      labelAr: 'أمتعة مشمولة',
      labelEn: 'Baggage included',
      weight: 0.06,
    })
  }
  return reasons.slice(0, 4)
}

export function scoreConversationFlight(
  flight: RankableFlight,
  prefs: ConversationRankPrefs,
  cohort: { minPrice: number; maxPrice: number; minDuration: number; maxDuration: number },
): number {
  const price = flight.price ?? cohort.maxPrice
  const duration = flight.durationMinutes ?? cohort.maxDuration
  const priceRange = Math.max(1, cohort.maxPrice - cohort.minPrice)
  const durationRange = Math.max(1, cohort.maxDuration - cohort.minDuration)
  const priceScore = 1 - (price - cohort.minPrice) / priceRange
  const durationScore = 1 - (duration - cohort.minDuration) / durationRange
  const stops = flight.stops ?? 2
  const stopsScore = stops <= 0 ? 1 : stops === 1 ? 0.6 : 0.25
  const preferred = (prefs.preferredAirline ?? '').trim().toLowerCase()
  const airlineScore = preferred
    ? (flight.airline ?? '').toLowerCase().includes(preferred)
      ? 1
      : 0.4
    : 0.7
  const convenience = convenienceScore(flight, prefs)
  const confidence = flight.providerId === 'amadeus' ? 0.95 : flight.providerId === 'mock' ? 0.6 : 0.85

  return (
    priceScore * 0.28
    + durationScore * 0.18
    + stopsScore * 0.18
    + convenience * 0.14
    + airlineScore * 0.12
    + confidence * 0.1
  )
}

export function rankConversationFlights(
  flights: RankableFlight[],
  prefs: ConversationRankPrefs = {},
): RankedConversationFlight[] {
  if (flights.length === 0) return []
  const prices = flights.map((f) => f.price ?? 0)
  const durations = flights.map((f) => f.durationMinutes ?? 0)
  const cohort = {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
  }

  return flights
    .map((flight) => {
      const reasons = buildReasons(flight, prefs, cohort)
      const score = scoreConversationFlight(flight, prefs, cohort)
      const whyAr = reasons.length
        ? reasons.map((r) => r.labelAr).join(' · ')
        : 'خيار متوازن للرحلة'
      const whyEn = reasons.length
        ? reasons.map((r) => r.labelEn).join(' · ')
        : 'Balanced option for this trip'
      return {
        id: flight.id,
        providerId: flight.providerId,
        airline: flight.airline,
        flightNumber: flight.flightNumber ?? null,
        origin: flight.origin,
        destination: flight.destination,
        departureAt: flight.departureAt,
        arrivalAt: flight.arrivalAt,
        durationMinutes: flight.durationMinutes,
        stops: flight.stops,
        cabin: flight.cabin,
        fareFamily: flight.fareFamily ?? null,
        price: flight.price,
        currency: flight.currency,
        baggage: flight.baggage ?? null,
        refundable: flight.refundable,
        score,
        reasons,
        whyAr,
        whyEn,
      }
    })
    .sort((a, b) => b.score - a.score)
}
