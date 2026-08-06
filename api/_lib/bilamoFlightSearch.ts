/**
 * Bilamo flight search — server-only Amadeus + deterministic demo.
 * Vendor payloads never leave this module; responses are normalized offers only.
 * Secrets: AMADEUS_API_KEY / AMADEUS_API_SECRET (never VITE_*).
 */

import { readAmadeusCredentials } from './amadeusEnv.js'
import { checkEdgeRateLimit } from './edgeGuard.js'

export type BilamoApiFlightOffer = {
  offerId: string
  airline: string
  flightNumber: string | null
  origin: string
  destination: string
  departAt: string
  arriveAt: string
  durationMinutes: number
  stops: number
  layovers: Array<{ airport: string; durationMinutes: number }>
  cabin: string
  baggageSummary: string | null
  refundable: boolean | null
  changeable: boolean | null
  totalPrice: number
  currency: string
  provider: 'demo' | 'amadeus'
  bookingReference: string | null
  deepLink: string | null
  fetchedAt: string
}

export type BilamoFlightSearchBody = {
  origin: string
  destination: string
  departureDate: string
  returnDate?: string | null
  adults?: number
  children?: number
  infants?: number
  cabin?: string
  cabinClass?: string
  directOnly?: boolean
  preferDirect?: boolean
  preferredAirlines?: string[]
  maxStops?: number | null
  currency?: string
}

export type BilamoFlightSearchApiResult = {
  ok: boolean
  mode: 'demo' | 'live'
  offers: BilamoApiFlightOffer[]
  error: string | null
  rateLimited?: boolean
  fallbackDemo?: boolean
  fallbackReason?: string | null
}

const AIRLINE_NAMES: Record<string, string> = {
  SV: 'Saudia',
  EK: 'Emirates',
  QR: 'Qatar Airways',
  TK: 'Turkish Airlines',
  XY: 'flynas',
  F3: 'flyadeal',
  BA: 'British Airways',
  AF: 'Air France',
  LH: 'Lufthansa',
}

function parseDurationMinutes(iso: string | undefined): number | null {
  if (!iso) return null
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(iso)
  if (!match) return null
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)
}

function mapCabin(raw: string | null | undefined): string {
  const v = (raw || 'economy').toLowerCase().replace(/[\s-]+/g, '_')
  if (v.includes('first')) return 'first'
  if (v.includes('business')) return 'business'
  if (v.includes('premium')) return 'premium_economy'
  return 'economy'
}

function amadeusTravelClass(cabin: string): string | null {
  const key = cabin.toLowerCase()
  if (key === 'first') return 'FIRST'
  if (key === 'business') return 'BUSINESS'
  if (key === 'premium_economy') return 'PREMIUM_ECONOMY'
  if (key === 'economy') return 'ECONOMY'
  return null
}

export function buildDemoBilamoOffers(body: BilamoFlightSearchBody): BilamoApiFlightOffer[] {
  const origin = body.origin.toUpperCase().slice(0, 3)
  const destination = body.destination.toUpperCase().slice(0, 3)
  const departureDate = body.departureDate
  const currency = (body.currency || 'SAR').toUpperCase().slice(0, 3)
  const cabin = mapCabin(body.cabin || body.cabinClass)
  const directOnly = body.directOnly === true || body.preferDirect === true || body.maxStops === 0
  const fetchedAt = new Date().toISOString()
  const basePrice = cabin === 'business' ? 9000 : cabin === 'first' ? 14000 : 2700

  const rows: BilamoApiFlightOffer[] = [
    {
      offerId: `demo_${origin}_${destination}_0`,
      airline: 'Saudia',
      flightNumber: 'SV100',
      origin,
      destination,
      departAt: `${departureDate}T08:40:00Z`,
      arriveAt: `${departureDate}T18:55:00Z`,
      durationMinutes: 620,
      stops: 0,
      layovers: [],
      cabin,
      baggageSummary: '2 PC',
      refundable: true,
      changeable: true,
      totalPrice: basePrice + 190,
      currency,
      provider: 'demo',
      bookingReference: null,
      deepLink: null,
      fetchedAt,
    },
    {
      offerId: `demo_${origin}_${destination}_1`,
      airline: 'Turkish Airlines',
      flightNumber: 'TK200',
      origin,
      destination,
      departAt: `${departureDate}T14:10:00Z`,
      arriveAt: `${departureDate}T23:50:00Z`,
      durationMinutes: 640,
      stops: 0,
      layovers: [],
      cabin,
      baggageSummary: '1 PC',
      refundable: false,
      changeable: null,
      totalPrice: basePrice,
      currency,
      provider: 'demo',
      bookingReference: null,
      deepLink: null,
      fetchedAt,
    },
    {
      offerId: `demo_${origin}_${destination}_2`,
      airline: 'Emirates',
      flightNumber: 'EK300',
      origin,
      destination,
      departAt: `${departureDate}T01:20:00Z`,
      arriveAt: `${departureDate}T14:20:00Z`,
      durationMinutes: 780,
      stops: 1,
      layovers: [{ airport: 'DXB', durationMinutes: 95 }],
      cabin,
      baggageSummary: '2 PC',
      refundable: true,
      changeable: true,
      totalPrice: Math.max(400, basePrice - 280),
      currency,
      provider: 'demo',
      bookingReference: null,
      deepLink: null,
      fetchedAt,
    },
  ]

  return rows.filter((o) => !directOnly || o.stops === 0)
}

type AmadeusRawOffer = {
  id?: string
  numberOfBookableSeats?: number
  itineraries?: Array<{
    duration?: string
    segments?: Array<{
      departure?: { iataCode?: string; at?: string }
      arrival?: { iataCode?: string; at?: string }
      carrierCode?: string
      number?: string
      numberOfStops?: number
      duration?: string
    }>
  }>
  price?: { total?: string; currency?: string; grandTotal?: string }
  travelerPricings?: Array<{
    fareDetailsBySegment?: Array<{
      cabin?: string
      includedCheckedBags?: { quantity?: number; weight?: number }
    }>
  }>
  pricingOptions?: { refundableFare?: boolean }
}

function normalizeAmadeusOffer(raw: AmadeusRawOffer, index: number): BilamoApiFlightOffer | null {
  const segments = raw.itineraries?.[0]?.segments ?? []
  if (!segments.length) return null
  const first = segments[0]!
  const last = segments[segments.length - 1]!
  const stops = Math.max(0, segments.length - 1)
  const code = (first.carrierCode || 'XX').toUpperCase()
  const airline = AIRLINE_NAMES[code] || code
  const flightNumber = first.number ? `${code}${first.number}` : null
  const origin = (first.departure?.iataCode || '').toUpperCase()
  const destination = (last.arrival?.iataCode || '').toUpperCase()
  if (!origin || !destination) return null

  const layovers: Array<{ airport: string; durationMinutes: number }> = []
  for (let i = 0; i < segments.length - 1; i += 1) {
    const arrive = segments[i]?.arrival?.at
    const depart = segments[i + 1]?.departure?.at
    const airport = (segments[i]?.arrival?.iataCode || 'HUB').toUpperCase()
    let durationMinutes = 90
    if (arrive && depart) {
      const ms = new Date(depart).getTime() - new Date(arrive).getTime()
      if (Number.isFinite(ms) && ms > 0) durationMinutes = Math.round(ms / 60_000)
    }
    layovers.push({ airport, durationMinutes })
  }

  const bags = raw.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.includedCheckedBags
  const baggageSummary = bags?.quantity != null
    ? `${bags.quantity} PC`
    : bags?.weight != null
      ? `${bags.weight} kg`
      : null

  const price = Number(raw.price?.grandTotal ?? raw.price?.total ?? 0)
  const cabin = mapCabin(raw.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin)
  const durationMinutes = parseDurationMinutes(raw.itineraries?.[0]?.duration)
    ?? Math.max(60, segments.length * 180)

  return {
    offerId: raw.id || `amadeus_${index}`,
    airline,
    flightNumber,
    origin,
    destination,
    departAt: first.departure?.at || new Date().toISOString(),
    arriveAt: last.arrival?.at || new Date().toISOString(),
    durationMinutes,
    stops,
    layovers,
    cabin,
    baggageSummary,
    refundable: typeof raw.pricingOptions?.refundableFare === 'boolean'
      ? raw.pricingOptions.refundableFare
      : null,
    changeable: null,
    totalPrice: Number.isFinite(price) ? price : 0,
    currency: (raw.price?.currency || 'SAR').toUpperCase(),
    provider: 'amadeus',
    bookingReference: null,
    deepLink: null,
    fetchedAt: new Date().toISOString(),
  }
}

async function fetchAmadeusToken(
  host: string,
  clientId: string,
  clientSecret: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })
  const response = await fetch(`${host}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal,
  })
  if (!response.ok) {
    await response.text().catch(() => '')
    return null
  }
  const json = await response.json() as { access_token?: string }
  return json.access_token || null
}

async function searchAmadeusLive(
  body: BilamoFlightSearchBody,
  env: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<{ offers: BilamoApiFlightOffer[]; error: string | null; rateLimited: boolean }> {
  const creds = readAmadeusCredentials(env)
  if (!creds.hasCredentials || !creds.clientId || !creds.clientSecret) {
    return { offers: [], error: 'missing_credentials', rateLimited: false }
  }

  const token = await fetchAmadeusToken(creds.host, creds.clientId, creds.clientSecret, signal)
  if (!token) {
    return { offers: [], error: 'auth_failed', rateLimited: false }
  }

  const adults = Math.max(1, Math.floor(body.adults ?? 1))
  const children = Math.max(0, Math.floor(body.children ?? 0))
  const infants = Math.max(0, Math.floor(body.infants ?? 0))
  const cabin = mapCabin(body.cabin || body.cabinClass)
  const directOnly = body.directOnly === true || body.preferDirect === true || body.maxStops === 0
  const params = new URLSearchParams({
    originLocationCode: body.origin.toUpperCase().slice(0, 3),
    destinationLocationCode: body.destination.toUpperCase().slice(0, 3),
    departureDate: body.departureDate,
    adults: String(adults),
    currencyCode: (body.currency || 'SAR').toUpperCase().slice(0, 3),
    max: '20',
  })
  if (body.returnDate) params.set('returnDate', body.returnDate)
  if (children > 0) params.set('children', String(children))
  if (infants > 0) params.set('infants', String(infants))
  const travelClass = amadeusTravelClass(cabin)
  if (travelClass) params.set('travelClass', travelClass)
  if (directOnly) params.set('nonStop', 'true')

  const url = `${creds.host}/v2/shopping/flight-offers?${params}`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal,
    })
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    return {
      offers: [],
      error: name === 'AbortError' ? 'timeout' : 'network_error',
      rateLimited: false,
    }
  }

  if (response.status === 429) {
    await response.text().catch(() => '')
    return { offers: [], error: 'rate_limited', rateLimited: true }
  }
  if (!response.ok) {
    await response.text().catch(() => '')
    return { offers: [], error: `amadeus_http_${response.status}`, rateLimited: false }
  }

  const json = await response.json() as { data?: AmadeusRawOffer[] }
  let offers = (json.data ?? [])
    .map((row, i) => normalizeAmadeusOffer(row, i))
    .filter((o): o is BilamoApiFlightOffer => o != null)

  const preferred = (body.preferredAirlines || []).map((a) => a.toLowerCase())
  if (preferred.length) {
    offers = [...offers].sort((a, b) => {
      const ah = `${a.airline} ${a.flightNumber || ''}`.toLowerCase()
      const bh = `${b.airline} ${b.flightNumber || ''}`.toLowerCase()
      const as = preferred.some((p) => ah.includes(p)) ? 0 : 1
      const bs = preferred.some((p) => bh.includes(p)) ? 0 : 1
      return as - bs
    })
  }

  const maxStops = typeof body.maxStops === 'number' ? body.maxStops : null
  if (maxStops != null) {
    offers = offers.filter((o) => o.stops <= maxStops)
  }

  return { offers, error: offers.length ? null : 'empty', rateLimited: false }
}

export function parseBilamoFlightSearchBody(raw: Record<string, unknown>): BilamoFlightSearchBody | null {
  const origin = String(raw.origin || '').trim().toUpperCase().slice(0, 3)
  const destination = String(raw.destination || '').trim().toUpperCase().slice(0, 3)
  const departureDate = String(raw.departureDate || '').trim()
  if (!origin || !destination || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) return null

  return {
    origin,
    destination,
    departureDate,
    returnDate: raw.returnDate == null ? null : String(raw.returnDate),
    adults: Number(raw.adults) || 1,
    children: Number(raw.children) || 0,
    infants: Number(raw.infants) || 0,
    cabin: String(raw.cabin || raw.cabinClass || 'economy'),
    directOnly: raw.directOnly === true,
    preferDirect: raw.preferDirect === true,
    preferredAirlines: Array.isArray(raw.preferredAirlines)
      ? raw.preferredAirlines.map(String)
      : [],
    maxStops: typeof raw.maxStops === 'number' ? raw.maxStops : null,
    currency: String(raw.currency || 'SAR'),
  }
}

/**
 * Run Bilamo flight search: live Amadeus when credentials exist, else demo.
 * Always returns usable offers when fallback is enabled (default).
 */
export async function runBilamoFlightSearch(options: {
  body: BilamoFlightSearchBody
  env?: Record<string, string | undefined>
  signal?: AbortSignal
  clientKey?: string
  fallbackToDemo?: boolean
  forceDemo?: boolean
}): Promise<BilamoFlightSearchApiResult> {
  const env = options.env ?? (process.env as Record<string, string | undefined>)
  const fallbackToDemo = options.fallbackToDemo !== false
  const clientKey = options.clientKey || 'anon'

  if (!checkEdgeRateLimit(`bilamo-flights:${clientKey}`, 30, 60_000)) {
    if (fallbackToDemo) {
      return {
        ok: true,
        mode: 'demo',
        offers: buildDemoBilamoOffers(options.body),
        error: 'rate_limited',
        rateLimited: true,
        fallbackDemo: true,
        fallbackReason: 'rate_limited',
      }
    }
    return {
      ok: false,
      mode: 'live',
      offers: [],
      error: 'rate_limited',
      rateLimited: true,
      fallbackDemo: false,
      fallbackReason: 'rate_limited',
    }
  }

  if (options.forceDemo) {
    return {
      ok: true,
      mode: 'demo',
      offers: buildDemoBilamoOffers(options.body),
      error: null,
      fallbackDemo: true,
      fallbackReason: 'force_demo',
    }
  }

  const creds = readAmadeusCredentials(env)
  if (!creds.hasCredentials) {
    return {
      ok: true,
      mode: 'demo',
      offers: buildDemoBilamoOffers(options.body),
      error: null,
      fallbackDemo: true,
      fallbackReason: 'missing_credentials',
    }
  }

  try {
    const live = await searchAmadeusLive(options.body, env, options.signal)
    if (live.offers.length > 0) {
      return {
        ok: true,
        mode: 'live',
        offers: live.offers,
        error: null,
        rateLimited: live.rateLimited,
        fallbackDemo: false,
        fallbackReason: null,
      }
    }
    if (fallbackToDemo) {
      return {
        ok: true,
        mode: 'demo',
        offers: buildDemoBilamoOffers(options.body),
        error: live.error,
        rateLimited: live.rateLimited,
        fallbackDemo: true,
        fallbackReason: live.error,
      }
    }
    return {
      ok: false,
      mode: 'live',
      offers: [],
      error: live.error,
      rateLimited: live.rateLimited,
      fallbackDemo: false,
      fallbackReason: live.error,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'live_failed'
    if (fallbackToDemo) {
      return {
        ok: true,
        mode: 'demo',
        offers: buildDemoBilamoOffers(options.body),
        error: message,
        fallbackDemo: true,
        fallbackReason: message,
      }
    }
    return {
      ok: false,
      mode: 'live',
      offers: [],
      error: message,
      fallbackDemo: false,
      fallbackReason: message,
    }
  }
}
