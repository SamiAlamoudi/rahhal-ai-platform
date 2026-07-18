import type { FlightOffer, FlightSegment, FlightItinerary, CabinClass } from '../../../utils/contracts/models/flight'
import type {
  AmadeusFlightOffer,
  AmadeusSegment,
  AmadeusItinerary,
  AmadeusDictionaries,
  AmadeusFareDetail,
} from './amadeusFlightApiClient'
import { buildAmadeusSandboxBookingUrl } from './amadeusSandbox'

const CABIN_MAP: Record<string, CabinClass> = {
  ECONOMY: 'economy',
  PREMIUM_ECONOMY: 'premium-economy',
  BUSINESS: 'business',
  FIRST: 'first',
}

export function mapCabin(raw: string | undefined): CabinClass {
  if (!raw) return 'economy'
  return CABIN_MAP[raw.toUpperCase()] ?? 'economy'
}

export function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return 0
  const hours = parseInt(match[1] ?? '0', 10)
  const minutes = parseInt(match[2] ?? '0', 10)
  return hours * 60 + minutes
}

export interface FlightQualityScores {
  travelTimeScore: number
  overallFlightQuality: number
}

export function computeFlightQuality(
  totalDurationMinutes: number,
  stops: number,
  cabin: CabinClass,
  baggageIncluded: boolean,
): FlightQualityScores {
  let travelTimeScore = 50
  if (totalDurationMinutes > 0) {
    if (totalDurationMinutes <= 360) travelTimeScore = 100
    else if (totalDurationMinutes <= 600) travelTimeScore = 85
    else if (totalDurationMinutes <= 900) travelTimeScore = 70
    else if (totalDurationMinutes <= 1200) travelTimeScore = 55
    else travelTimeScore = 35
  }

  let qualityScore = travelTimeScore
  if (stops === 0) qualityScore += 15
  else if (stops === 1) qualityScore += 5
  else if (stops >= 3) qualityScore -= 15

  if (cabin === 'business' || cabin === 'first') qualityScore += 10
  if (cabin === 'premium-economy') qualityScore += 5
  if (baggageIncluded) qualityScore += 5

  return {
    travelTimeScore: Math.max(0, Math.min(100, travelTimeScore)),
    overallFlightQuality: Math.max(0, Math.min(100, qualityScore)),
  }
}

function buildSegment(
  raw: AmadeusSegment,
  dictionaries: AmadeusDictionaries | undefined,
  fareDetails: AmadeusFareDetail[] | undefined,
): FlightSegment {
  const carrierName = dictionaries?.carriers?.[raw.carrierCode] ?? raw.carrierCode
  const aircraftName = raw.aircraft
    ? dictionaries?.aircraft?.[raw.aircraft.code] ?? raw.aircraft.code
    : null
  const fareDetail = fareDetails?.find(fd => fd.segmentId === raw.id)
  const cabin = mapCabin(fareDetail?.cabin)

  return {
    origin: raw.departure.iataCode,
    destination: raw.arrival.iataCode,
    departure: raw.departure.at,
    arrival: raw.arrival.at,
    carrier: carrierName,
    flightNumber: `${raw.carrierCode}${raw.number}`,
    aircraft: aircraftName,
    cabin,
    durationMinutes: parseDuration(raw.duration),
  }
}

function extractBaggageIncluded(
  offer: AmadeusFlightOffer,
): boolean {
  const travelerPricings = offer.travelerPricings
  if (!travelerPricings || travelerPricings.length === 0) return false
  const firstPricing = travelerPricings[0]
  const fareDetails = firstPricing.fareDetailsBySegment
  if (!fareDetails || fareDetails.length === 0) return false
  return fareDetails.some(fd => fd.includedCheckedBags !== undefined && fd.includedCheckedBags !== null)
}

function extractBookingClass(
  offer: AmadeusFlightOffer,
): string {
  const travelerPricings = offer.travelerPricings
  if (!travelerPricings || travelerPricings.length === 0) return 'ECONOMY'
  const firstPricing = travelerPricings[0]
  const fareDetails = firstPricing.fareDetailsBySegment
  if (!fareDetails || fareDetails.length === 0) return 'ECONOMY'
  return fareDetails[0].class ?? fareDetails[0].cabin ?? 'ECONOMY'
}

function extractRefundable(offer: AmadeusFlightOffer): boolean {
  return offer.pricingOptions?.refundableFare ?? false
}

function extractCabin(offer: AmadeusFlightOffer): CabinClass {
  const travelerPricings = offer.travelerPricings
  if (!travelerPricings || travelerPricings.length === 0) return 'economy'
  const firstPricing = travelerPricings[0]
  const fareDetails = firstPricing.fareDetailsBySegment
  if (!fareDetails || fareDetails.length === 0) return 'economy'
  return mapCabin(fareDetails[0].cabin)
}

function buildTitle(firstItinerary: AmadeusItinerary, dictionaries: AmadeusDictionaries | undefined): string {
  const segments = firstItinerary.segments
  if (segments.length === 0) return 'Flight'
  const first = segments[0]
  const last = segments[segments.length - 1]
  const carrierName = dictionaries?.carriers?.[first.carrierCode] ?? first.carrierCode
  const stops = segments.length - 1
  const stopLabel = stops === 0 ? 'مباشر' : `${stops} توقف`
  return `${carrierName} ${first.carrierCode}${first.number}: ${first.departure.iataCode} → ${last.arrival.iataCode} (${stopLabel})`
}

export interface NormalizedFlightOffer extends FlightOffer {
  bookingClass: string
  travelTimeScore: number
  overallFlightQuality: number
}

export function normalizeAmadeusFlightOffer(
  offer: AmadeusFlightOffer,
  dictionaries: AmadeusDictionaries | undefined,
  providerId: string,
  options: { host?: string | null } = {},
): NormalizedFlightOffer {
  const firstItinerary = offer.itineraries[0]
  const fareDetails = offer.travelerPricings?.[0]?.fareDetailsBySegment
  const segments = firstItinerary.segments.map(seg =>
    buildSegment(seg, dictionaries, fareDetails),
  )
  const totalDuration = parseDuration(firstItinerary.duration)
  const stops = firstItinerary.segments.length - 1
  const cabin = extractCabin(offer)
  const baggageIncluded = extractBaggageIncluded(offer)
  const refundable = extractRefundable(offer)
  const bookingClass = extractBookingClass(offer)
  const quality = computeFlightQuality(totalDuration, stops, cabin, baggageIncluded)

  const itinerary: FlightItinerary = {
    segments,
    totalDuration,
    stops,
    refundable,
    baggageIncluded,
  }

  const price = parseFloat(offer.price.total)
  const basePrice = parseFloat(offer.price.base)
  const hasDiscount = !isNaN(basePrice) && basePrice > 0 && price < basePrice

  const rating = quality.overallFlightQuality / 20

  return {
    id: offer.id,
    providerId,
    title: buildTitle(firstItinerary, dictionaries),
    currency: offer.price.currency,
    price: Math.round(price * 100) / 100,
    originalPrice: hasDiscount ? Math.round(basePrice * 100) / 100 : null,
    rating: Math.round(rating * 10) / 10,
    itinerary,
    familyFriendly: offer.numberOfBookableSeats >= 2,
    cancellationPolicy: refundable ? 'refundable' : 'non-refundable',
    bookingUrl: buildAmadeusSandboxBookingUrl(offer.id, { host: options.host }),
    bookingClass,
    travelTimeScore: quality.travelTimeScore,
    overallFlightQuality: quality.overallFlightQuality,
  }
}

export function normalizeAmadeusResponse(
  response: { data: AmadeusFlightOffer[]; dictionaries?: AmadeusDictionaries },
  providerId: string,
  options: { host?: string | null } = {},
): NormalizedFlightOffer[] {
  if (!response.data || !Array.isArray(response.data)) return []
  return response.data.map(offer =>
    normalizeAmadeusFlightOffer(offer, response.dictionaries, providerId, options),
  )
}

export type { AmadeusDictionaries }
