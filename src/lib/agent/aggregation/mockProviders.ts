import { moneyFromSeed, pick, stableHash } from '../tools/mockData'
import type {
  AggregatableDomain,
  AggregationQuery,
  NormalizedOffer,
  ProviderAdapter,
  ProviderFetchResult,
  ProviderMetadata,
} from './types'

function meta(
  id: ProviderMetadata['id'],
  displayName: string,
  domains: AggregatableDomain[],
  priority: number,
  reliability: number,
): ProviderMetadata {
  return { id, displayName, domains, priority, reliability, mocked: true }
}

interface OfferDraft {
  domain: NormalizedOffer['domain']
  fingerprint: string
  title: string
  price: number | null
  currency: string | null
  providerId: string
  scoreHints: NormalizedOffer['scoreHints']
  payload: Record<string, unknown>
  confidence?: number
}

function ok(
  providerId: string,
  started: number,
  items: OfferDraft[],
): ProviderFetchResult {
  return {
    providerId,
    status: 'ok',
    items: items.map((item) => ({
      domain: item.domain,
      fingerprint: item.fingerprint,
      title: item.title,
      price: item.price,
      currency: item.currency,
      providerId: item.providerId,
      scoreHints: item.scoreHints,
      payload: item.payload,
      confidence: item.confidence ?? 0.7,
      rankScore: 0,
    })),
    error: null,
    durationMs: Date.now() - started,
  }
}

function airportCode(destination: string): string {
  const key = destination.toLowerCase()
  if (key.includes('japan') || key.includes('tokyo')) return 'HND'
  if (key.includes('london')) return 'LHR'
  if (key.includes('bali')) return 'DPS'
  if (key.includes('paris')) return 'CDG'
  if (key.includes('dubai')) return 'DXB'
  if (key.includes('riyadh')) return 'RUH'
  return destination.slice(0, 3).toUpperCase() || 'XXX'
}

function createFlightAdapter(
  metadata: ProviderMetadata,
  airlinePool: string[],
  priceBias: number,
): ProviderAdapter {
  return {
    metadata,
    isAvailable: () => true,
    supports: (domain) => metadata.domains.includes(domain),
    async fetch(query) {
      const started = Date.now()
      if (query.domain !== 'flights') {
        return { providerId: metadata.id, status: 'skipped', items: [], error: 'unsupported_domain', durationMs: 0 }
      }
      const origin = String(query.input.origin ?? 'RUH')
      const destination = String(query.input.destination ?? 'TYO')
      const travelers = Number(query.input.travelers ?? 2)
      const currency = String(query.input.currency ?? 'USD')
      const to = airportCode(destination)
      const airline = pick(airlinePool, `${metadata.id}-${destination}`)
      const stops = stableHash(`${metadata.id}-${destination}`) % 2
      const durationHours = 5 + (stableHash(`${metadata.id}-dur`) % 9)
      const price = moneyFromSeed(`${metadata.id}-${origin}-${to}`, 600 + priceBias, 180)
      const fingerprint = `flight:${origin}:${to}:${stops}:${Math.round(price / 50)}`
      return ok(metadata.id, started, [{
        domain: 'flights',
        fingerprint,
        title: `${airline} ${origin}→${to}`,
        price,
        currency,
        providerId: metadata.id,
        scoreHints: {
          priceCompetitiveness: clamp01(1 - (price - 500) / 800),
          durationQuality: clamp01(1 - durationHours / 20),
          relevance: 0.85,
        },
        payload: {
          id: `flt_${metadata.id}_${stableHash(fingerprint)}`,
          airline,
          from: origin,
          to,
          cabin: 'economy',
          stops,
          durationHours,
          price,
          currency,
          travelers,
        },
      }])
    },
  }
}

function createHotelAdapter(
  metadata: ProviderMetadata,
  nameSuffix: string,
  nightlyBias: number,
): ProviderAdapter {
  return {
    metadata,
    isAvailable: () => true,
    supports: (domain) => metadata.domains.includes(domain),
    async fetch(query) {
      const started = Date.now()
      if (query.domain !== 'hotels') {
        return { providerId: metadata.id, status: 'skipped', items: [], error: 'unsupported_domain', durationMs: 0 }
      }
      const destination = String(query.input.destination ?? 'City')
      const nights = Number(query.input.nights ?? 3)
      const currency = String(query.input.currency ?? 'USD')
      const nightly = moneyFromSeed(`${metadata.id}-${destination}`, 120 + nightlyBias, 50)
      const fingerprint = `hotel:${destination.toLowerCase()}:central:${Math.round(nightly / 20)}`
      return ok(metadata.id, started, [{
        domain: 'hotels',
        fingerprint,
        title: `${destination} ${nameSuffix}`,
        price: nightly,
        currency,
        providerId: metadata.id,
        scoreHints: {
          priceCompetitiveness: clamp01(1 - nightly / 400),
          rating: 0.7 + (stableHash(metadata.id) % 20) / 100,
          relevance: 0.8,
        },
        payload: {
          name: `${destination} ${nameSuffix}`,
          area: destination,
          category: nightlyBias > 40 ? 'boutique' : 'hotel',
          nightly,
          nights,
          total: nightly * nights,
          currency,
          score: 8 + (stableHash(metadata.id) % 10) / 10,
        },
      }])
    },
  }
}

export function createMockAmadeusAdapter(): ProviderAdapter {
  return createFlightAdapter(
    meta('amadeus', 'Amadeus (mock)', ['flights'], 80, 0.9),
    ['Amadeus Mock Air', 'Sky Mock'],
    20,
  )
}

export function createMockDuffelAdapter(): ProviderAdapter {
  return createFlightAdapter(
    meta('duffel', 'Duffel (mock)', ['flights'], 70, 0.86),
    ['Duffel Mock Air', 'Atlas Mock'],
    40,
  )
}

export function createMockBookingComAdapter(): ProviderAdapter {
  return createHotelAdapter(
    meta('booking_com', 'Booking.com (mock)', ['hotels'], 85, 0.88),
    'Center by Booking',
    10,
  )
}

export function createMockExpediaAdapter(): ProviderAdapter {
  return createHotelAdapter(
    meta('expedia', 'Expedia (mock)', ['hotels'], 75, 0.84),
    'Select by Expedia',
    30,
  )
}

export function createMockOpenWeatherAdapter(): ProviderAdapter {
  const metadata = meta('openweather', 'OpenWeather (mock)', ['weather'], 90, 0.92)
  return {
    metadata,
    isAvailable: () => true,
    supports: (domain) => domain === 'weather',
    async fetch(query) {
      const started = Date.now()
      const destination = String(query.input.destination ?? '')
      const month = String(query.input.startDate ?? '').slice(5, 7)
      const season = month === '04' || destination.toLowerCase().includes('japan') ? 'spring' : 'mild'
      const averageHighC = 12 + (stableHash(`${destination}-${season}`) % 16)
      const summary = `${season} conditions in ${destination}: daytime ~${averageHighC}°C`
      return ok(metadata.id, started, [{
        domain: 'weather',
        fingerprint: `weather:${destination.toLowerCase()}:${season}`,
        title: summary,
        price: null,
        currency: null,
        providerId: metadata.id,
        scoreHints: { relevance: 0.95 },
        payload: { summary, averageHighC, season, destination, monthHint: month ? Number(month) : null },
      }])
    },
  }
}

export function createMockGoogleMapsAdapter(): ProviderAdapter {
  const metadata = meta('google_maps', 'Google Maps (mock)', ['maps'], 80, 0.9)
  return {
    metadata,
    isAvailable: () => true,
    supports: (domain) => domain === 'maps',
    async fetch(query) {
      const started = Date.now()
      const hubs = Array.isArray(query.input.hubs) ? query.input.hubs.map(String) : [String(query.input.destination ?? 'City')]
      const from = hubs[0]
      const to = hubs[1] ?? hubs[0]
      const distanceKm = 12 + (stableHash(`gmap-${from}-${to}`) % 80)
      return ok(metadata.id, started, [{
        domain: 'maps',
        fingerprint: `maps:${from}:${to}:transit`,
        title: `${from} → ${to}`,
        price: null,
        currency: null,
        providerId: metadata.id,
        scoreHints: { relevance: 0.9, durationQuality: 0.8 },
        payload: {
          from,
          to,
          mode: 'transit',
          distanceKm,
          durationMinutes: 25 + (stableHash(to) % 60),
        },
      }])
    },
  }
}

export function createMockOpenStreetMapAdapter(): ProviderAdapter {
  const metadata = meta('openstreetmap', 'OpenStreetMap (mock)', ['maps'], 60, 0.8)
  return {
    metadata,
    isAvailable: () => true,
    supports: (domain) => domain === 'maps',
    async fetch(query) {
      const started = Date.now()
      const destination = String(query.input.destination ?? 'City')
      // Intentional near-duplicate fingerprint branch for dedupe tests against google_maps style
      const from = destination
      const to = destination
      return ok(metadata.id, started, [{
        domain: 'maps',
        fingerprint: `maps:${from}:${to}:walk_and_metro`,
        title: `${destination} local loop`,
        price: null,
        currency: null,
        providerId: metadata.id,
        scoreHints: { relevance: 0.75, durationQuality: 0.7 },
        payload: {
          from,
          to,
          mode: 'walk_and_metro',
          distanceKm: 8 + (stableHash(destination) % 15),
          durationMinutes: 35,
        },
      }])
    },
  }
}

export function createMockExchangeRateAdapter(): ProviderAdapter {
  const metadata = meta('exchangerate', 'ExchangeRate (mock)', ['currency'], 70, 0.9)
  return {
    metadata,
    isAvailable: () => true,
    supports: (domain) => domain === 'currency',
    async fetch(query) {
      const started = Date.now()
      const amount = Number(query.input.amount ?? 1000)
      const from = String(query.input.fromCurrency ?? 'USD')
      const to = String(query.input.toCurrency ?? 'USD')
      const rate = from === to ? 1 : from === 'USD' && to === 'JPY' ? 150 : 3.2
      const convertedAmount = Math.round(amount * rate * 100) / 100
      return ok(metadata.id, started, [{
        domain: 'currency',
        fingerprint: `fx:${from}:${to}:${amount}`,
        title: `${amount} ${from} → ${convertedAmount} ${to}`,
        price: convertedAmount,
        currency: to,
        providerId: metadata.id,
        scoreHints: { relevance: 1 },
        payload: { amount, fromCurrency: from, toCurrency: to, rate, convertedAmount },
      }])
    },
  }
}

export function createMockVisaInfoAdapter(): ProviderAdapter {
  const metadata = meta('visa_info', 'Visa Info (mock)', ['visa'], 65, 0.85)
  return {
    metadata,
    isAvailable: () => true,
    supports: (domain) => domain === 'visa',
    async fetch(query) {
      const started = Date.now()
      const destination = String(query.input.destination ?? '')
      const nationality = String(query.input.nationality ?? 'SA')
      const guidance = destination.toLowerCase().includes('japan')
        ? 'Mock: many Saudi travelers use visa waiver / eVisa paths for short Japan trips — confirm before booking.'
        : `Mock visa guidance for ${nationality} travelers to ${destination}. Confirm official rules before travel.`
      return ok(metadata.id, started, [{
        domain: 'visa',
        fingerprint: `visa:${nationality}:${destination.toLowerCase()}`,
        title: `Visa guidance · ${destination}`,
        price: null,
        currency: null,
        providerId: metadata.id,
        scoreHints: { relevance: 0.9 },
        payload: { status: 'check_required', guidance, destination, nationality },
      }])
    },
  }
}

export function createMockAttractionsCatalogAdapter(): ProviderAdapter {
  const metadata = meta('attractions_catalog', 'Attractions Catalog (mock)', ['attractions'], 70, 0.87)
  return {
    metadata,
    isAvailable: () => true,
    supports: (domain) => domain === 'attractions',
    async fetch(query) {
      const started = Date.now()
      const destination = String(query.input.destination ?? 'City')
      const interests = Array.isArray(query.input.interests) ? query.input.interests.map(String) : []
      const titles = destination.toLowerCase().includes('japan')
        ? ['Senso-ji', 'Shibuya Crossing', 'Meiji Shrine', 'teamLab Planets']
        : [`${destination} Old Town`, `${destination} Market`, `${destination} Viewpoint`]
      return ok(
        metadata.id,
        started,
        titles.map((title, index) => ({
          domain: 'attractions' as const,
          fingerprint: `attraction:${destination.toLowerCase()}:${title.toLowerCase()}`,
          title,
          price: null,
          currency: null,
          providerId: metadata.id,
          scoreHints: { relevance: 0.9 - index * 0.05 },
          payload: {
            id: `att_${index}_${stableHash(title)}`,
            title,
            destination,
            tag: interests[index % Math.max(1, interests.length)] || 'highlight',
          },
        })),
      )
    },
  }
}

/** Future provider slots registered as unavailable (interfaces only). */
export function createUnavailableProviderStub(
  id: ProviderMetadata['id'],
  displayName: string,
  domains: AggregatableDomain[],
): ProviderAdapter {
  const metadata = meta(id, displayName, domains, 10, 0.5)
  return {
    metadata: { ...metadata, mocked: true },
    isAvailable: () => false,
    supports: (domain) => domains.includes(domain),
    async fetch() {
      return {
        providerId: id,
        status: 'skipped',
        items: [],
        error: 'not_configured',
        durationMs: 0,
      }
    },
  }
}

export function createDefaultMockProviderAdapters(): ProviderAdapter[] {
  return [
    createMockAmadeusAdapter(),
    createMockDuffelAdapter(),
    createMockBookingComAdapter(),
    createMockExpediaAdapter(),
    createMockOpenWeatherAdapter(),
    createMockGoogleMapsAdapter(),
    createMockOpenStreetMapAdapter(),
    createMockExchangeRateAdapter(),
    createMockVisaInfoAdapter(),
    createMockAttractionsCatalogAdapter(),
  ]
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** Exported helper for tests that want intentional duplicates across providers */
export function createDuplicateFlightAdapterForTests(): ProviderAdapter {
  const amadeus = createMockAmadeusAdapter()
  return {
    ...amadeus,
    metadata: {
      ...amadeus.metadata,
      id: 'duffel_dup_test',
      displayName: 'Duffel Dup (test)',
      priority: 50,
      reliability: 0.7,
    },
    async fetch(query: AggregationQuery) {
      const result = await amadeus.fetch(query)
      return {
        ...result,
        providerId: 'duffel_dup_test',
        items: result.items.map((item) => ({
          ...item,
          providerId: 'duffel_dup_test',
          // same fingerprint → dedupe
        })),
      }
    },
  }
}
