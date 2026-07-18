/**
 * Maps Amadeus flight offers to Rahhal FlightOffer models, sorts them,
 * and formats conversation-friendly responses.
 */

import type { FlightOffer } from '../../../utils/contracts/models/flight'
import type { AmadeusDictionaries, AmadeusFlightOffer } from './amadeusFlightApiClient'
import {
  normalizeAmadeusFlightOffer,
  normalizeAmadeusResponse,
  mapCabin,
  parseDuration,
  computeFlightQuality,
  type NormalizedFlightOffer,
} from './flightNormalization'

export type FlightSortMode = 'best-value' | 'lowest-price' | 'shortest-duration'

export const TOP_FLIGHT_OPTIONS = 5

export interface MappedFlightOffer extends NormalizedFlightOffer {
  airlineCode: string
  airlineName: string
  departureDateLabel: string
  returnDateLabel: string | null
  durationLabel: string
  valueScore: number
}

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatDateLabel(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    // Already a date-only string like 2026-07-30
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!match) return iso
    const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatPrice(amount: number, currency: string): string {
  const rounded = Math.round(amount)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'SAR',
      maximumFractionDigits: 0,
    }).format(rounded)
  } catch {
    return `${currency || 'SAR'} ${rounded.toLocaleString('en-US')}`
  }
}

function computeValueScore(offer: FlightOffer): number {
  const price = offer.price > 0 ? offer.price : 1
  const duration = offer.itinerary.totalDuration > 0 ? offer.itinerary.totalDuration : 1
  const stopPenalty = 1 + offer.itinerary.stops * 0.15
  const quality = typeof (offer as NormalizedFlightOffer).overallFlightQuality === 'number'
    ? (offer as NormalizedFlightOffer).overallFlightQuality
    : (offer.rating ?? 3) * 20
  // Higher is better: quality / (price × duration factor × stops)
  return (quality * 1000) / (price * Math.sqrt(duration / 60) * stopPenalty)
}

export function enrichMappedOffer(
  offer: NormalizedFlightOffer,
  options: { returnDate?: string | null } = {},
): MappedFlightOffer {
  const first = offer.itinerary.segments[0]
  const airlineName = first?.carrier ?? 'Airline'
  const airlineCode = first?.flightNumber?.replace(/\d+/g, '') || airlineName.slice(0, 2).toUpperCase()

  return {
    ...offer,
    airlineCode,
    airlineName,
    departureDateLabel: formatDateLabel(first?.departure ?? null),
    returnDateLabel: options.returnDate ? formatDateLabel(options.returnDate) : null,
    durationLabel: formatDuration(offer.itinerary.totalDuration),
    valueScore: computeValueScore(offer),
  }
}

export function mapAmadeusOffers(
  response: { data: AmadeusFlightOffer[]; dictionaries?: AmadeusDictionaries },
  providerId: string,
  options: { host?: string | null; returnDate?: string | null } = {},
): MappedFlightOffer[] {
  const normalized = normalizeAmadeusResponse(response, providerId, { host: options.host })
  return normalized.map((offer) => enrichMappedOffer(offer, { returnDate: options.returnDate }))
}

/**
 * Sort offers and keep the top N.
 * Modes can be composed: best-value is the default ranking; lowest-price and
 * shortest-duration are applied as secondary sorts when scores are close.
 */
export function sortAndSelectTopFlights(
  offers: MappedFlightOffer[],
  limit: number = TOP_FLIGHT_OPTIONS,
  primary: FlightSortMode = 'best-value',
): MappedFlightOffer[] {
  const sorted = [...offers].sort((a, b) => {
    if (primary === 'lowest-price') {
      if (a.price !== b.price) return a.price - b.price
      if (a.itinerary.totalDuration !== b.itinerary.totalDuration) {
        return a.itinerary.totalDuration - b.itinerary.totalDuration
      }
      return b.valueScore - a.valueScore
    }
    if (primary === 'shortest-duration') {
      if (a.itinerary.totalDuration !== b.itinerary.totalDuration) {
        return a.itinerary.totalDuration - b.itinerary.totalDuration
      }
      if (a.price !== b.price) return a.price - b.price
      return b.valueScore - a.valueScore
    }
    // best-value (default): value score, then price, then duration
    if (a.valueScore !== b.valueScore) return b.valueScore - a.valueScore
    if (a.price !== b.price) return a.price - b.price
    return a.itinerary.totalDuration - b.itinerary.totalDuration
  })
  return sorted.slice(0, Math.max(0, limit))
}

/**
 * Blend best-value / lowest-price / shortest-duration into a diversified top-5:
 * rank primarily by value, but ensure price and duration leaders stay visible.
 */
export function selectTopFlightOptions(
  offers: MappedFlightOffer[],
  limit: number = TOP_FLIGHT_OPTIONS,
): MappedFlightOffer[] {
  if (offers.length <= limit) {
    return sortAndSelectTopFlights(offers, limit, 'best-value')
  }

  const byValue = sortAndSelectTopFlights(offers, offers.length, 'best-value')
  const cheapest = sortAndSelectTopFlights(offers, 1, 'lowest-price')[0]
  const shortest = sortAndSelectTopFlights(offers, 1, 'shortest-duration')[0]

  const selected: MappedFlightOffer[] = []
  const seen = new Set<string>()

  const push = (offer: MappedFlightOffer | undefined) => {
    if (!offer || seen.has(offer.id) || selected.length >= limit) return
    seen.add(offer.id)
    selected.push(offer)
  }

  push(byValue[0])
  push(cheapest)
  push(shortest)
  for (const offer of byValue) {
    push(offer)
  }

  return selected
}

/**
 * Conversation-first flight card (English labels as specified by product sprint).
 *
 * Example:
 * ✈️ Saudi Airlines
 * Riyadh → Casablanca
 * ...
 */
export function formatFlightOfferForConversation(
  offer: MappedFlightOffer | FlightOffer,
  options: {
    originLabel?: string
    destinationLabel?: string
    returnDate?: string | null
  } = {},
): string {
  const mapped = 'airlineName' in offer && 'durationLabel' in offer
    ? (offer as MappedFlightOffer)
    : enrichMappedOffer(offer as NormalizedFlightOffer, { returnDate: options.returnDate })

  const first = mapped.itinerary.segments[0]
  const last = mapped.itinerary.segments[mapped.itinerary.segments.length - 1]
  const origin = options.originLabel || first?.origin || '—'
  const destination = options.destinationLabel || last?.destination || '—'
  const returnLabel = mapped.returnDateLabel
    ?? (options.returnDate ? formatDateLabel(options.returnDate) : null)

  const lines = [
    `✈️ ${mapped.airlineName}`,
    `${origin} → ${destination}`,
    '',
    'Departure:',
    mapped.departureDateLabel,
    '',
  ]

  if (returnLabel) {
    lines.push('Return:', returnLabel, '')
  }

  lines.push(
    'Duration:',
    mapped.durationLabel,
    '',
    'Stops:',
    String(mapped.itinerary.stops),
    '',
    'Price:',
    formatPrice(mapped.price, mapped.currency),
  )

  return lines.join('\n')
}

export function formatFlightOffersForConversation(
  offers: Array<MappedFlightOffer | FlightOffer>,
  options: {
    originLabel?: string
    destinationLabel?: string
    returnDate?: string | null
  } = {},
): string {
  if (offers.length === 0) return ''
  return offers
    .map((offer) => formatFlightOfferForConversation(offer, options))
    .join('\n\n————\n\n')
}

export {
  normalizeAmadeusFlightOffer,
  normalizeAmadeusResponse,
  mapCabin,
  parseDuration,
  computeFlightQuality,
  type NormalizedFlightOffer,
}
