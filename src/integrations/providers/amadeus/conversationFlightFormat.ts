/**
 * Format ranked flight options for the Rahhal conversation UI.
 * Uses the sprint response shape (airline, route, dates, duration, stops, price).
 */

import type { NormalizedTravelOption } from '../../../utils/searchOrchestrator'
import { formatFlightOfferForConversation, type MappedFlightOffer } from './FlightMapper'
import type { FlightOffer } from '../../../utils/contracts/models/flight'

function formatDuration(minutes: number | null): string {
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
    const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!match) return String(iso)
    const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function asMappedFromRanked(
  option: NormalizedTravelOption,
  returnDate?: string | null,
): MappedFlightOffer {
  const airline = String(option.attributes.airline ?? 'Airline')
  const origin = String(option.attributes.origin ?? '—')
  const destination = String(option.attributes.destination ?? option.location ?? '—')
  const departureTime = option.attributes.departureTime
    ? String(option.attributes.departureTime)
    : null
  const flightNumber = String(option.attributes.flightNumber ?? '')

  const offer = {
    id: option.id,
    providerId: option.providerIds[0] ?? 'amadeus-flight-001',
    title: option.title,
    currency: option.currency,
    price: option.price,
    originalPrice: null,
    rating: option.rating,
    itinerary: {
      segments: [{
        origin,
        destination,
        departure: departureTime ?? '',
        arrival: '',
        carrier: airline,
        flightNumber,
        aircraft: null,
        cabin: 'economy',
        durationMinutes: option.durationMinutes ?? 0,
      }],
      totalDuration: option.durationMinutes ?? 0,
      stops: option.stops ?? 0,
      refundable: option.refundable ?? false,
      baggageIncluded: option.baggageIncluded ?? false,
    },
    familyFriendly: option.familyFriendly ?? false,
    cancellationPolicy: null,
    bookingClass: 'ECONOMY',
    travelTimeScore: 50,
    overallFlightQuality: (option.rating ?? 3) * 20,
    airlineCode: flightNumber.replace(/\d+/g, '') || airline.slice(0, 2).toUpperCase(),
    airlineName: airline,
    departureDateLabel: formatDateLabel(departureTime),
    returnDateLabel: returnDate ? formatDateLabel(returnDate) : null,
    durationLabel: formatDuration(option.durationMinutes),
    valueScore: 0,
  } satisfies MappedFlightOffer

  return offer
}

/**
 * Build conversation text for the top flight options from a live search result.
 */
export function formatRankedFlightsForConversation(
  rankedOptions: NormalizedTravelOption[],
  options: {
    originLabel?: string
    destinationLabel?: string
    returnDate?: string | null
    limit?: number
  } = {},
): string {
  const flights = rankedOptions
    .filter((opt) => opt.type === 'flight')
    .slice(0, options.limit ?? 5)

  if (flights.length === 0) return ''

  const blocks = flights.map((flight) => {
    const mapped = asMappedFromRanked(flight, options.returnDate)
    return formatFlightOfferForConversation(mapped, {
      originLabel: options.originLabel,
      destinationLabel: options.destinationLabel,
      returnDate: options.returnDate,
    })
  })

  return [
    'Here are the best flight options I found for you:',
    '',
    blocks.join('\n\n————\n\n'),
  ].join('\n')
}

export type { FlightOffer }
