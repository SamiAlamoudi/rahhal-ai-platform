/**
 * Parallel Search Orchestrator — one request → multi-domain bundle.
 * Flights ∥ Hotels ∥ Transfer ∥ Weather ∥ Visa ∥ Currency ∥ Time difference.
 * Flights go through Bilamo FlightSearchProvider (demo by default, live via server API).
 */

import { enrichMockHotel } from '../../agent/hotelSearchEngine/normalize'
import type { TripRequirements } from '../../agent/types'
import {
  createBilamoFlightSearchProvider,
  recommendFlights,
  scoredOfferToBilamoFlight,
  type BilamoFlightSearchRequest,
  type FlightSearchProvider,
} from '../flights'
import type {
  BilamoContextIntel,
  BilamoFlightOption,
  BilamoHotelOption,
  BilamoSearchBundle,
} from './types'

const CITY_AIRPORTS: Record<string, { code: string; originDefault: string }> = {
  japan: { code: 'HND', originDefault: 'RUH' },
  tokyo: { code: 'HND', originDefault: 'RUH' },
  osaka: { code: 'KIX', originDefault: 'RUH' },
  kyoto: { code: 'KIX', originDefault: 'RUH' },
  istanbul: { code: 'IST', originDefault: 'RUH' },
  paris: { code: 'CDG', originDefault: 'RUH' },
  london: { code: 'LHR', originDefault: 'RUH' },
  dubai: { code: 'DXB', originDefault: 'RUH' },
  bali: { code: 'DPS', originDefault: 'RUH' },
  maldives: { code: 'MLE', originDefault: 'RUH' },
  lisbon: { code: 'LIS', originDefault: 'RUH' },
  rome: { code: 'FCO', originDefault: 'RUH' },
  barcelona: { code: 'BCN', originDefault: 'RUH' },
  cairo: { code: 'CAI', originDefault: 'RUH' },
  morocco: { code: 'RAK', originDefault: 'RUH' },
  switzerland: { code: 'ZRH', originDefault: 'RUH' },
}

function airportFor(destination: string | null): { code: string; originDefault: string } {
  const key = (destination || '').toLowerCase().trim()
  for (const [name, info] of Object.entries(CITY_AIRPORTS)) {
    if (key.includes(name)) return info
  }
  return { code: (destination || 'XXX').slice(0, 3).toUpperCase(), originDefault: 'RUH' }
}

function originAirportCode(origin: string | null, fallback: string): string {
  if (!origin) return fallback
  const raw = origin.trim()
  if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase()
  const key = raw.toLowerCase()
  if (key.includes('riyadh') || key.includes('رياض')) return 'RUH'
  if (key.includes('jeddah') || key.includes('جدة') || key.includes('جده')) return 'JED'
  if (key.includes('dammam') || key.includes('دمام')) return 'DMM'
  if (key.includes('dubai') || key.includes('دبي')) return 'DXB'
  if (key.includes('london') || key.includes('لندن')) return 'LHR'
  return fallback
}

function toFlightSearchRequest(
  req: TripRequirements,
  signal?: AbortSignal,
): BilamoFlightSearchRequest | null {
  const dest = req.destination || req.destinations[0] || null
  if (!dest) return null
  const airport = airportFor(dest)
  const origin = originAirportCode(req.origin, airport.originDefault)

  const preferred = req.preferredAirline ? [req.preferredAirline] : []
  const cabinRaw = (req.cabinPreference || 'economy').toLowerCase()
  const cabin = cabinRaw.includes('business')
    ? 'business' as const
    : cabinRaw.includes('first')
      ? 'first' as const
      : cabinRaw.includes('premium')
        ? 'premium_economy' as const
        : 'economy' as const

  const directOnly = /prefer_direct|direct|nonstop|non-stop|مباشر|بدون\s*توقف/i.test(req.notes || '')

  return {
    origin,
    destination: airport.code,
    departureDate: req.startDate || '2026-09-12',
    returnDate: req.endDate,
    adults: Math.max(1, (req.travelers ?? 1) - Math.max(0, req.children ?? 0)),
    children: Math.max(0, req.children ?? 0),
    infants: /\binfant|baby|رضيع|رضع/i.test(req.notes || '') ? 1 : 0,
    cabin,
    directOnly,
    preferredAirlines: preferred,
    maxStops: directOnly ? 0 : null,
    currency: req.budgetCurrency || 'SAR',
    signal,
  }
}

async function searchFlights(
  req: TripRequirements,
  options?: {
    signal?: AbortSignal
    provider?: FlightSearchProvider
    onProgress?: (message: string) => void
    locale?: 'ar' | 'en'
  },
): Promise<{
  flights: BilamoFlightOption[]
  meta: NonNullable<BilamoSearchBundle['flightsMeta']>
}> {
  const request = toFlightSearchRequest(req, options?.signal)
  if (!request) {
    return {
      flights: [],
      meta: { mode: 'demo', error: null, stale: false, bestScore: null },
    }
  }

  options?.onProgress?.('I have enough information to search.')
  const provider = options?.provider ?? createBilamoFlightSearchProvider()
  options?.onProgress?.(
    request.directOnly
      ? 'Comparing direct options first.'
      : 'Comparing direct and one-stop options.',
  )

  const result = await provider.searchFlights(request)
  const recommendation = recommendFlights(result.offers, request, {
    mode: result.mode,
    error: result.error,
    stale: Boolean(result.error && result.ok),
    locale: options?.locale === 'en' ? 'en' : 'ar',
  })

  if (!recommendation) {
    return {
      flights: [],
      meta: {
        mode: result.mode,
        error: result.error || 'no_offers',
        stale: false,
        bestScore: null,
      },
    }
  }

  options?.onProgress?.(
    `I found ${recommendation.display.length} strong choice${recommendation.display.length === 1 ? '' : 's'}.`,
  )
  if (recommendation.best.kind === 'best') {
    options?.onProgress?.(recommendation.best.reason)
  }

  return {
    flights: recommendation.display.map(scoredOfferToBilamoFlight),
    meta: {
      mode: recommendation.mode,
      error: recommendation.error,
      stale: recommendation.stale,
      bestScore: recommendation.best.score,
    },
  }
}

async function searchHotels(req: TripRequirements): Promise<BilamoHotelOption[]> {
  const city = req.destinationCity || req.destination || req.destinations[0] || 'City'
  const currency = req.budgetCurrency || 'SAR'
  const nights = req.durationDays ?? 4
  const hotelPref = (req.hotelPreference || '').toLowerCase()
  const luxury = hotelPref.includes('luxury') || hotelPref.includes('فاخر')
    || req.budgetStyle === 'luxury'

  const raw = [
    enrichMockHotel({
      city,
      currency,
      pricePerNight: luxury ? 920 : 620,
      stars: 5,
      hotelName: luxury ? `Edition ${city}` : `${city} House`,
      rating: 4.8,
    }, 0),
    enrichMockHotel({
      city,
      currency,
      pricePerNight: luxury ? 780 : 480,
      stars: 4,
      hotelName: `${city} Central`,
      rating: 4.5,
    }, 1),
  ]

  return raw.map((h, i) => ({
    id: h.hotelId || `bilamo-h-${i}`,
    name: h.hotelName,
    area: 'City center',
    rating: h.rating ?? (i === 0 ? 4.8 : 4.5),
    nightsLabel: `${nights} night${nights === 1 ? '' : 's'}`,
    price: Math.round((h.pricePerNight || 500) * nights),
    currency: h.currency || currency,
    reason: i === 0
      ? 'Quiet luxury with an easy rhythm after arrival.'
      : 'Solid central alternative if you want to stay closer to everything.',
    score: 96 - i * 10,
  }))
}

async function searchTransfer(req: TripRequirements): Promise<string | null> {
  const dest = req.destination || req.destinations[0]
  if (!dest) return null
  return `Private airport transfer arranged on arrival in ${dest} (~45–60 min).`
}

async function searchWeather(req: TripRequirements): Promise<string | null> {
  const dest = req.destination || req.destinations[0]
  if (!dest) return null
  const month = req.startDate ? new Date(req.startDate).getUTCMonth() : new Date().getUTCMonth()
  const mild = month >= 3 && month <= 5 || month >= 8 && month <= 10
  return mild
    ? `${dest}: mild and pleasant for walking — light layers recommended.`
    : `${dest}: expect seasonal weather — pack a versatile layer for evenings.`
}

async function searchVisa(req: TripRequirements): Promise<string | null> {
  const dest = req.destination || req.destinations[0]
  if (!dest) return null
  const lower = dest.toLowerCase()
  if (lower.includes('japan') || lower.includes('tokyo') || lower.includes('osaka')) {
    return 'Japan: most Gulf passport holders can enter visa-free for short stays — confirm before travel.'
  }
  if (lower.includes('dubai') || lower.includes('istanbul') || lower.includes('maldives')) {
    return `${dest}: typically straightforward entry for short leisure stays — I will confirm your passport rules.`
  }
  return `${dest}: I will verify visa requirements against your passport before we lock anything.`
}

async function searchCurrency(req: TripRequirements): Promise<string | null> {
  const dest = req.destination || req.destinations[0]
  if (!dest) return null
  const lower = dest.toLowerCase()
  if (lower.includes('japan') || lower.includes('tokyo')) return 'Local currency: Japanese Yen (JPY). Cards widely accepted in cities.'
  if (lower.includes('istanbul') || lower.includes('turkey')) return 'Local currency: Turkish Lira (TRY).'
  if (lower.includes('paris') || lower.includes('rome') || lower.includes('lisbon') || lower.includes('barcelona')) {
    return 'Local currency: Euro (EUR).'
  }
  if (lower.includes('dubai') || lower.includes('uae')) return 'Local currency: UAE Dirham (AED).'
  if (lower.includes('london')) return 'Local currency: British Pound (GBP).'
  return `I will quote options in ${req.budgetCurrency || 'SAR'} and note the local currency on the ground.`
}

async function searchTimeDifference(req: TripRequirements): Promise<string | null> {
  const dest = req.destination || req.destinations[0]
  if (!dest) return null
  const lower = dest.toLowerCase()
  if (lower.includes('japan') || lower.includes('tokyo')) return 'About +6 hours ahead of Riyadh — plan a soft first evening.'
  if (lower.includes('london') || lower.includes('paris') || lower.includes('lisbon')) {
    return 'Roughly −2 to −3 hours from Riyadh — mild jet lag.'
  }
  if (lower.includes('dubai')) return 'Same time zone as Riyadh — easy arrival.'
  if (lower.includes('istanbul')) return 'About −1 hour from Riyadh.'
  return 'I will align your first day to the local clock so arrival feels calm.'
}

function buildTimeline(
  req: TripRequirements,
  flight: BilamoFlightOption | null,
  hotel: BilamoHotelOption | null,
): BilamoSearchBundle['timeline'] {
  const dest = req.destination || req.destinations[0] || 'destination'
  const items: BilamoSearchBundle['timeline'] = []
  if (flight) {
    items.push({
      id: 'tl-arrive',
      time: 'Day 1 · Morning',
      title: `Arrive ${dest}`,
      detail: `${flight.airline} · ${flight.departTime} → ${flight.arriveTime}. Soft landing.`,
      kind: 'flight',
    })
  }
  items.push({
    id: 'tl-transfer',
    time: 'Day 1 · Midday',
    title: 'Airport transfer',
    detail: 'Private car to your stay — no rushing.',
    kind: 'transfer',
  })
  if (hotel) {
    items.push({
      id: 'tl-hotel',
      time: 'Day 1 · Evening',
      title: hotel.name,
      detail: `${hotel.area}. ${hotel.reason}`,
      kind: 'hotel',
    })
  }
  return items
}

export async function runBilamoSearchOrchestrator(input: {
  requirements: TripRequirements
  signal?: AbortSignal
  flightProvider?: FlightSearchProvider
  onFlightProgress?: (message: string) => void
  locale?: 'ar' | 'en'
}): Promise<BilamoSearchBundle> {
  const req = input.requirements
  const locale = input.locale === 'en' ? 'en' : 'ar'
  const [
    flightPack,
    hotels,
    transfer,
    weather,
    visa,
    currency,
    timeDifference,
  ] = await Promise.all([
    searchFlights(req, {
      signal: input.signal,
      provider: input.flightProvider,
      onProgress: input.onFlightProgress,
      locale,
    }),
    searchHotels(req),
    searchTransfer(req),
    searchWeather(req),
    searchVisa(req),
    searchCurrency(req),
    searchTimeDifference(req),
  ])

  if (input.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const flights = flightPack.flights
  const context: BilamoContextIntel = {
    weather,
    visa,
    currency,
    timeDifference,
    transfer,
  }

  return {
    flights,
    hotels,
    context,
    timeline: buildTimeline(req, flights[0] ?? null, hotels[0] ?? null),
    flightsMeta: flightPack.meta,
  }
}
