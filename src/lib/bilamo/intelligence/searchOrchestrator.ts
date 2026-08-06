/**
 * Parallel Search Orchestrator — one request → multi-domain bundle.
 * Flights ∥ Hotels ∥ Transfer ∥ Weather ∥ Visa ∥ Currency ∥ Time difference.
 * Mock-friendly by default (no live provider keys required).
 */

import { enrichMockFlight } from '../../agent/flightSearchEngine/normalize'
import { enrichMockHotel } from '../../agent/hotelSearchEngine/normalize'
import type { TripRequirements } from '../../agent/types'
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

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function clock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toISOString().slice(11, 16)
}

async function searchFlights(req: TripRequirements): Promise<BilamoFlightOption[]> {
  const dest = req.destination || req.destinations[0] || null
  if (!dest) return []
  const airport = airportFor(dest)
  const origin = (req.origin || airport.originDefault).toUpperCase().slice(0, 3)
  const currency = req.budgetCurrency || 'SAR'
  const dep = req.startDate || '2026-09-12'
  const cabin = (req.cabinPreference as 'economy' | 'business' | undefined) || 'economy'
  const preferred = (req.preferredAirline || '').toLowerCase()
  const preferredAirlineName = preferred.includes('qatar') || preferred === 'qr'
    ? 'Qatar Airways'
    : preferred.includes('emirate') || preferred === 'ek'
      ? 'Emirates'
      : preferred.includes('saud') || preferred === 'sv'
        ? 'Saudia'
        : preferred.includes('turkish') || preferred === 'tk'
          ? 'Turkish Airlines'
          : 'Saudia'

  const raw = [
    enrichMockFlight({
      origin,
      destination: airport.code,
      currency,
      cabin,
      airline: preferredAirlineName,
      price: cabin === 'business' ? 9200 : 2890,
      stops: 0,
      duration: 620,
      departureTime: `${dep}T08:40:00Z`,
      arrivalTime: `${dep}T18:55:00Z`,
    }, 0),
    enrichMockFlight({
      origin,
      destination: airport.code,
      currency,
      cabin,
      airline: preferredAirlineName === 'Turkish Airlines' ? 'Saudia' : 'Turkish Airlines',
      price: cabin === 'business' ? 8800 : 3140,
      stops: 0,
      duration: 640,
      departureTime: `${dep}T14:10:00Z`,
      arrivalTime: `${dep}T23:50:00Z`,
    }, 1),
    enrichMockFlight({
      origin,
      destination: airport.code,
      currency,
      cabin,
      airline: preferredAirlineName === 'Emirates' ? 'Qatar Airways' : 'Emirates',
      price: cabin === 'business' ? 10500 : 3420,
      stops: 1,
      duration: 780,
      departureTime: `${dep}T01:20:00Z`,
      arrivalTime: `${dep}T14:20:00Z`,
    }, 2),
  ]

  return raw.map((f, i) => ({
    id: f.id || `bilamo-f-${i}`,
    airline: f.airline,
    origin: f.origin,
    destination: f.destination,
    departTime: clock(f.departureTime),
    arriveTime: clock(f.arrivalTime),
    duration: formatDuration(f.duration || 600),
    stopsLabel: (f.stops ?? 0) === 0 ? 'Nonstop' : `${f.stops} stop`,
    price: f.price,
    currency: f.currency || currency,
    reason: i === 0
      ? 'Best balance of schedule, comfort, and total cost.'
      : i === 1
        ? 'Strong afternoon alternative with excellent connections.'
        : 'Premium carrier — useful if you prefer a hub stop.',
    score: 100 - i * 8,
  }))
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
}): Promise<BilamoSearchBundle> {
  const req = input.requirements
  const [
    flights,
    hotels,
    transfer,
    weather,
    visa,
    currency,
    timeDifference,
  ] = await Promise.all([
    searchFlights(req),
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
  }
}
