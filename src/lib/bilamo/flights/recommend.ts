/**
 * Bilamo Recommendation Engine V1 — transparent weighted scoring.
 * Always explain why #1 is best. Expose best / cheapest / fastest.
 */

import type {
  BilamoFlightSearchRequest,
  FlightRecommendationSet,
  NormalizedFlightOffer,
  ScoredFlightOffer,
} from './types'

/** Configurable weights — independently tested. */
export const BILAMO_FLIGHT_SCORE_WEIGHTS = {
  price: 0.28,
  duration: 0.22,
  stops: 0.16,
  layover: 0.08,
  schedule: 0.08,
  airline: 0.08,
  baggage: 0.05,
  direct: 0.05,
} as const

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function departureHour(iso: string): number | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.getUTCHours()
}

function scheduleConvenience(hour: number | null): number {
  if (hour == null) return 0.5
  // Prefer mid-morning / late afternoon; penalize red-eyes.
  if (hour >= 8 && hour <= 11) return 1
  if (hour >= 14 && hour <= 19) return 0.9
  if (hour >= 6 && hour < 8) return 0.7
  if (hour >= 20 && hour <= 22) return 0.55
  return 0.25
}

function airlineMatch(offer: NormalizedFlightOffer, prefs: string[]): number {
  if (!prefs.length) return 0.55
  const hay = `${offer.airline} ${offer.flightNumber || ''}`.toLowerCase()
  for (const p of prefs) {
    const needle = p.toLowerCase()
    if (!needle) continue
    if (hay.includes(needle)) return 1
    if (needle === 'sv' && hay.includes('saud')) return 1
    if (needle === 'ek' && hay.includes('emirate')) return 1
    if (needle === 'qr' && hay.includes('qatar')) return 1
  }
  return 0.2
}

export function scoreFlightOffer(
  offer: NormalizedFlightOffer,
  cohort: NormalizedFlightOffer[],
  request: Pick<BilamoFlightSearchRequest, 'preferredAirlines' | 'directOnly' | 'maxStops'>,
  weights: typeof BILAMO_FLIGHT_SCORE_WEIGHTS = BILAMO_FLIGHT_SCORE_WEIGHTS,
): ScoredFlightOffer {
  const prices = cohort.map((o) => o.totalPrice)
  const durations = cohort.map((o) => o.durationMinutes)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const minDur = Math.min(...durations)
  const maxDur = Math.max(...durations)
  const priceSpan = Math.max(1, maxPrice - minPrice)
  const durSpan = Math.max(1, maxDur - minDur)

  const price = 1 - (offer.totalPrice - minPrice) / priceSpan
  const duration = 1 - (offer.durationMinutes - minDur) / durSpan
  const stops = offer.stops <= 0 ? 1 : offer.stops === 1 ? 0.55 : 0.2
  const layoverMinutes = offer.layovers.reduce((s, l) => s + l.durationMinutes, 0)
  const layover = offer.stops === 0
    ? 1
    : clamp01(1 - Math.max(0, layoverMinutes - 60) / 240)
  const schedule = scheduleConvenience(departureHour(offer.departAt))
  const airline = airlineMatch(offer, request.preferredAirlines || [])
  const baggage = offer.baggageSummary
    ? (offer.baggageSummary.includes('2') ? 1 : 0.7)
    : 0.4
  const wantsDirect = request.directOnly === true || request.maxStops === 0
  const direct = wantsDirect
    ? (offer.stops === 0 ? 1 : 0.1)
    : (offer.stops === 0 ? 0.85 : 0.5)

  const breakdown = { price, duration, stops, layover, schedule, airline, baggage, direct }
  const score = Math.round(
    100 * (
      price * weights.price
      + duration * weights.duration
      + stops * weights.stops
      + layover * weights.layover
      + schedule * weights.schedule
      + airline * weights.airline
      + baggage * weights.baggage
      + direct * weights.direct
    ),
  )

  return {
    offer,
    score,
    kind: null,
    reason: '',
    breakdown,
  }
}

function explainBest(
  best: ScoredFlightOffer,
  cheapest: ScoredFlightOffer,
  fastest: ScoredFlightOffer,
): string {
  const b = best.offer
  const priceDelta = b.totalPrice - cheapest.offer.totalPrice
  const timeSaved = cheapest.offer.durationMinutes - b.durationMinutes
  const vsCheapestFaster = fastest.offer.offerId !== best.offer.offerId
    ? fastest.offer.durationMinutes - b.durationMinutes
    : 0

  if (b.stops === 0 && priceDelta > 0 && timeSaved >= 60) {
    const hours = Math.round(timeSaved / 60)
    return `I recommend this direct flight because it saves about ${hours} hour${hours === 1 ? '' : 's'} of travel for only ${b.currency} ${priceDelta.toLocaleString('en-US')} more than the cheapest option.`
  }
  if (best.offer.offerId === cheapest.offer.offerId && b.stops === 0) {
    return `I recommend this option — it is both the strongest overall choice and the lowest price, with a nonstop schedule.`
  }
  if (best.offer.offerId === fastest.offer.offerId && vsCheapestFaster <= 0) {
    return `I recommend this flight for the best balance of schedule and comfort — it is also among the fastest options at ${b.currency} ${b.totalPrice.toLocaleString('en-US')}.`
  }
  if (b.stops === 0) {
    return `I recommend this nonstop ${b.airline} service — cleaner arrival, stronger overall score (${best.score}/100).`
  }
  return `I recommend this ${b.airline} option for the best overall balance of price, time, and comfort (Bilamo Score ${best.score}/100).`
}

export function recommendFlights(
  offers: NormalizedFlightOffer[],
  request: Pick<BilamoFlightSearchRequest, 'preferredAirlines' | 'directOnly' | 'maxStops'>,
  options?: {
    mode?: FlightRecommendationSet['mode']
    error?: string | null
    stale?: boolean
    weights?: typeof BILAMO_FLIGHT_SCORE_WEIGHTS
  },
): FlightRecommendationSet | null {
  if (!offers.length) return null
  const weights = options?.weights ?? BILAMO_FLIGHT_SCORE_WEIGHTS
  const scored = offers
    .map((o) => scoreFlightOffer(o, offers, request, weights))
    .sort((a, b) => b.score - a.score || a.offer.totalPrice - b.offer.totalPrice)

  const best = { ...scored[0]!, kind: 'best' as const }
  const cheapestBase = [...scored].sort((a, b) => a.offer.totalPrice - b.offer.totalPrice)[0]!
  const fastestBase = [...scored].sort((a, b) => a.offer.durationMinutes - b.offer.durationMinutes
    || a.offer.totalPrice - b.offer.totalPrice)[0]!

  const cheapest: ScoredFlightOffer = {
    ...cheapestBase,
    kind: 'cheapest',
    reason: cheapestBase.offer.offerId === best.offer.offerId
      ? 'Also the lowest price among strong options.'
      : `Lowest price at ${cheapestBase.offer.currency} ${cheapestBase.offer.totalPrice.toLocaleString('en-US')}.`,
  }
  const fastest: ScoredFlightOffer = {
    ...fastestBase,
    kind: 'fastest',
    reason: fastestBase.offer.offerId === best.offer.offerId
      ? 'Also the fastest itinerary.'
      : `Fastest trip — ${Math.round(fastestBase.offer.durationMinutes / 60)}h ${fastestBase.offer.durationMinutes % 60}m total.`,
  }

  best.reason = explainBest(best, cheapest, fastest)

  const display: ScoredFlightOffer[] = [best]
  if (cheapest.offer.offerId !== best.offer.offerId) display.push(cheapest)
  if (
    fastest.offer.offerId !== best.offer.offerId
    && fastest.offer.offerId !== cheapest.offer.offerId
  ) {
    display.push(fastest)
  }
  // Ensure we always surface up to 3 for the UI when more offers exist.
  for (const row of scored) {
    if (display.length >= 3) break
    if (!display.some((d) => d.offer.offerId === row.offer.offerId)) {
      display.push({ ...row, kind: null, reason: row.reason || 'A solid alternative.' })
    }
  }

  return {
    best,
    cheapest,
    fastest,
    display,
    mode: options?.mode ?? 'demo',
    stale: options?.stale === true,
    error: options?.error ?? null,
  }
}
