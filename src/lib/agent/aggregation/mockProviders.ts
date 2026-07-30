import { createProviderAdapter } from './baseAdapter'
import { FUTURE_PROVIDER_CATALOG } from './capabilities'
import { moneyFromSeed, pick, stableHash } from '../tools/mockData'
import { resolveAirportCode } from '../airportCodes'
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
  futureSlot = false,
): ProviderMetadata {
  return { id, displayName, domains, priority, reliability, mocked: true, futureSlot }
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
    errorCode: null,
    durationMs: Date.now() - started,
  }
}

function airportCode(destination: string): string {
  return resolveAirportCode(destination)
}

function createFlightAdapter(
  metadata: ProviderMetadata,
  airlinePool: string[],
  priceBias: number,
): ProviderAdapter {
  return createProviderAdapter({
    metadata,
    capabilities: {
      features: ['search', 'offer_normalize'],
      supportsSearch: true,
      rateLimitPerMinute: 60,
    },
    async fetch(query) {
      const started = Date.now()
      const origin = String(query.input.origin ?? 'RUH')
      const destination = String(query.input.destination ?? 'TYO')
      const travelersRaw = Number(query.input.travelers)
      if (!Number.isFinite(travelersRaw) || travelersRaw <= 0) {
        // Never invent party size for mock inventory.
        return ok(String(metadata.id), started, [])
      }
      const travelers = Math.floor(travelersRaw)
      const currency = String(query.input.currency ?? 'USD')
      const to = airportCode(destination)
      const airline = pick(airlinePool, `${metadata.id}-${destination}`)
      const stops = stableHash(`${metadata.id}-${destination}`) % 2
      const durationHours = 5 + (stableHash(`${metadata.id}-dur`) % 9)
      const price = moneyFromSeed(`${metadata.id}-${origin}-${to}`, 600 + priceBias, 180)
      const fingerprint = `flight:${origin}:${to}:${stops}:${Math.round(price / 50)}`
      return ok(String(metadata.id), started, [{
        domain: 'flights',
        fingerprint,
        title: `${airline} ${origin}→${to}`,
        price,
        currency,
        providerId: String(metadata.id),
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
  })
}

function createHotelAdapter(
  metadata: ProviderMetadata,
  nameSuffix: string,
  nightlyBias: number,
): ProviderAdapter {
  return createProviderAdapter({
    metadata,
    capabilities: {
      features: ['search', 'stay_normalize'],
      supportsSearch: true,
      rateLimitPerMinute: 60,
    },
    async fetch(query) {
      const started = Date.now()
      const destination = String(query.input.destination ?? 'City')
      const nights = Number(query.input.nights ?? 3)
      const currency = String(query.input.currency ?? 'USD')
      const nightly = moneyFromSeed(`${metadata.id}-${destination}`, 120 + nightlyBias, 50)
      const fingerprint = `hotel:${destination.toLowerCase()}:central:${Math.round(nightly / 20)}`
      return ok(String(metadata.id), started, [{
        domain: 'hotels',
        fingerprint,
        title: `${destination} ${nameSuffix}`,
        price: nightly,
        currency,
        providerId: String(metadata.id),
        scoreHints: {
          priceCompetitiveness: clamp01(1 - nightly / 400),
          rating: 0.7 + (stableHash(String(metadata.id)) % 20) / 100,
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
          score: 8 + (stableHash(String(metadata.id)) % 10) / 10,
        },
      }])
    },
  })
}

/** Mock flights fallback used when the real Amadeus adapter is unavailable. */
export function createMockAmadeusAdapter(): ProviderAdapter {
  return createFlightAdapter(
    meta('amadeus_mock', 'Amadeus Mock Flights', ['flights'], 45, 0.9),
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

/** Mock hotels fallback used when the real Booking.com adapter is unavailable. */
export function createMockBookingComAdapter(): ProviderAdapter {
  return createHotelAdapter(
    meta('booking_com_mock', 'Booking.com Mock Hotels', ['hotels'], 45, 0.88),
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
  const metadata = meta('openweather_mock', 'OpenWeather (mock)', ['weather'], 45, 0.92)
  return createProviderAdapter({
    metadata,
    capabilities: { features: ['forecast_summary'], supportsRealtime: false, rateLimitPerMinute: 120 },
    async fetch(query) {
      const started = Date.now()
      const destination = String(query.input.destination ?? '')
      const month = String(query.input.startDate ?? '').slice(5, 7)
      const season = month === '04' || destination.toLowerCase().includes('japan') ? 'spring' : 'mild'
      const averageHighC = 12 + (stableHash(`${destination}-${season}`) % 16)
      const summary = `${season} conditions in ${destination}: daytime ~${averageHighC}°C`
      return ok(String(metadata.id), started, [{
        domain: 'weather',
        fingerprint: `weather:${destination.toLowerCase()}:${season}`,
        title: summary,
        price: null,
        currency: null,
        providerId: String(metadata.id),
        scoreHints: { relevance: 0.95 },
        payload: {
          summary,
          averageHighC,
          season,
          destination,
          monthHint: month ? Number(month) : null,
          source: 'openweather_mock',
        },
      }])
    },
  })
}

export function createMockGoogleMapsAdapter(): ProviderAdapter {
  const metadata = meta('google_maps_mock', 'Google Maps (mock)', ['maps'], 45, 0.9)
  return createProviderAdapter({
    metadata,
    capabilities: { features: ['route_legs', 'directions'], rateLimitPerMinute: 100 },
    async fetch(query) {
      const started = Date.now()
      const hubs = Array.isArray(query.input.hubs) ? query.input.hubs.map(String) : [String(query.input.destination ?? 'City')]
      const from = hubs[0]
      const to = hubs[1] ?? hubs[0]
      const distanceKm = 12 + (stableHash(`gmap-${from}-${to}`) % 80)
      return ok(String(metadata.id), started, [{
        domain: 'maps',
        fingerprint: `maps:${from}:${to}:transit`,
        title: `${from} → ${to}`,
        price: null,
        currency: null,
        providerId: String(metadata.id),
        scoreHints: { relevance: 0.9, durationQuality: 0.8 },
        payload: {
          from,
          to,
          mode: 'transit',
          distanceKm,
          durationMinutes: 25 + (stableHash(to) % 60),
          source: 'google_maps_mock',
        },
      }])
    },
  })
}

export function createMockOpenStreetMapAdapter(): ProviderAdapter {
  const metadata = meta('openstreetmap', 'OpenStreetMap (mock)', ['maps'], 60, 0.8)
  return createProviderAdapter({
    metadata,
    capabilities: { features: ['route_legs'], rateLimitPerMinute: 90 },
    async fetch(query) {
      const started = Date.now()
      const destination = String(query.input.destination ?? 'City')
      const from = destination
      const to = destination
      return ok(String(metadata.id), started, [{
        domain: 'maps',
        fingerprint: `maps:${from}:${to}:walk_and_metro`,
        title: `${destination} local loop`,
        price: null,
        currency: null,
        providerId: String(metadata.id),
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
  })
}

export function createMockExchangeRateAdapter(): ProviderAdapter {
  const metadata = meta('exchangerate', 'ExchangeRate (mock)', ['currency'], 70, 0.9)
  return createProviderAdapter({
    metadata,
    capabilities: { features: ['convert'], supportsSearch: false, rateLimitPerMinute: 120 },
    async fetch(query) {
      const started = Date.now()
      const amount = Number(query.input.amount ?? 1000)
      const from = String(query.input.fromCurrency ?? 'USD')
      const to = String(query.input.toCurrency ?? 'USD')
      const rate = from === to ? 1 : from === 'USD' && to === 'JPY' ? 150 : 3.2
      const convertedAmount = Math.round(amount * rate * 100) / 100
      return ok(String(metadata.id), started, [{
        domain: 'currency',
        fingerprint: `fx:${from}:${to}:${amount}`,
        title: `${amount} ${from} → ${convertedAmount} ${to}`,
        price: convertedAmount,
        currency: to,
        providerId: String(metadata.id),
        scoreHints: { relevance: 1 },
        payload: { amount, fromCurrency: from, toCurrency: to, rate, convertedAmount },
      }])
    },
  })
}

export function createMockVisaInfoAdapter(): ProviderAdapter {
  const metadata = meta('visa_info', 'Visa Info (mock)', ['visa'], 65, 0.85)
  return createProviderAdapter({
    metadata,
    capabilities: { features: ['guidance'], supportsSearch: false, rateLimitPerMinute: 40 },
    async fetch(query) {
      const started = Date.now()
      const destination = String(query.input.destination ?? '')
      const nationality = String(query.input.nationality ?? 'SA')
      const guidance = destination.toLowerCase().includes('japan')
        ? 'Mock: many Saudi travelers use visa waiver / eVisa paths for short Japan trips — confirm before booking.'
        : `Mock visa guidance for ${nationality} travelers to ${destination}. Confirm official rules before travel.`
      return ok(String(metadata.id), started, [{
        domain: 'visa',
        fingerprint: `visa:${nationality}:${destination.toLowerCase()}`,
        title: `Visa guidance · ${destination}`,
        price: null,
        currency: null,
        providerId: String(metadata.id),
        scoreHints: { relevance: 0.9 },
        payload: { status: 'check_required', guidance, destination, nationality },
      }])
    },
  })
}

export function createMockAttractionsCatalogAdapter(): ProviderAdapter {
  const metadata = meta('attractions_catalog', 'Attractions Catalog (mock)', ['attractions'], 70, 0.87)
  return createProviderAdapter({
    metadata,
    capabilities: { features: ['catalog_search'], supportsSearch: true, rateLimitPerMinute: 60 },
    async fetch(query) {
      const started = Date.now()
      const destination = String(query.input.destination ?? 'City')
      const interests = Array.isArray(query.input.interests) ? query.input.interests.map(String) : []
      const titles = destination.toLowerCase().includes('japan')
        ? ['Senso-ji', 'Shibuya Crossing', 'Meiji Shrine', 'teamLab Planets']
        : [`${destination} Old Town`, `${destination} Market`, `${destination} Viewpoint`]
      return ok(
        String(metadata.id),
        started,
        titles.map((title, index) => ({
          domain: 'attractions' as const,
          fingerprint: `attraction:${destination.toLowerCase()}:${title.toLowerCase()}`,
          title,
          price: null,
          currency: null,
          providerId: String(metadata.id),
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
  })
}

export function createMockRome2RioAdapter(): ProviderAdapter {
  const metadata = meta('rome2rio', 'Rome2Rio (mock)', ['transportation'], 78, 0.88)
  return createProviderAdapter({
    metadata,
    capabilities: {
      features: ['intercity_options', 'multimodal'],
      supportsSearch: true,
      rateLimitPerMinute: 50,
    },
    async fetch(query) {
      const started = Date.now()
      const destination = String(query.input.destination ?? 'City')
      const origin = String(query.input.origin ?? 'Your city')
      const hubs = Array.isArray(query.input.hubs) ? query.input.hubs.map(String) : []
      const currency = String(query.input.currency ?? 'USD')
      const segments = hubs.length >= 2
        ? [{ from: hubs[0], to: hubs[1], mode: 'train' as const }]
        : [{ from: origin, to: destination, mode: 'private_transfer' as const }]

      return ok(
        String(metadata.id),
        started,
        segments.map((segment, index) => {
          const price = moneyFromSeed(`${metadata.id}-${segment.from}-${segment.to}`, 35, 40)
          return {
            domain: 'transportation' as const,
            fingerprint: `transport:${segment.mode}:${segment.from}:${segment.to}`,
            title: `${segment.mode} ${segment.from} → ${segment.to}`,
            price,
            currency,
            providerId: String(metadata.id),
            scoreHints: { relevance: 0.88 - index * 0.05, durationQuality: 0.8 },
            payload: {
              mode: segment.mode,
              from: segment.from,
              to: segment.to,
              durationMinutes: 40 + (stableHash(segment.to) % 90),
              estimatedCost: price,
              currency,
              notes: 'Mock multimodal transport option (Rome2Rio adapter)',
            },
          }
        }),
      )
    },
  })
}

/** Future provider slots registered as unavailable (architecture only — no live HTTP). */
export function createUnavailableProviderStub(
  id: ProviderMetadata['id'],
  displayName: string,
  domains: AggregatableDomain[],
  features: string[] = [],
): ProviderAdapter {
  return createProviderAdapter({
    metadata: meta(id, displayName, domains, 10, 0.5, true),
    isAvailable: () => false,
    capabilities: {
      features: features.length ? features : ['future'],
      futureSlot: true,
      mocked: true,
      supportsSearch: true,
      rateLimitPerMinute: null,
    },
    async fetch() {
      return {
        providerId: String(id),
        status: 'skipped',
        items: [],
        error: 'not_configured',
        errorCode: 'not_configured',
        durationMs: 0,
      }
    },
  })
}

export function createFutureProviderStubs(): ProviderAdapter[] {
  return FUTURE_PROVIDER_CATALOG.map((entry) =>
    createUnavailableProviderStub(entry.id, entry.displayName, entry.domains, entry.features))
}

/** Active mock adapters (no live vendors). */
export function createActiveMockProviderAdapters(): ProviderAdapter[] {
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
    createMockRome2RioAdapter(),
  ]
}

/** Default registry population: live Amadeus (when configured) + mocks + future slots. */
export function createDefaultMockProviderAdapters(): ProviderAdapter[] {
  // Lazy import avoided — factory wires Amadeus via createDefaultProviderAdapters().
  return [
    ...createActiveMockProviderAdapters(),
    ...createFutureProviderStubs(),
  ]
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** Exported helper for tests that want intentional duplicates across providers */
export function createDuplicateFlightAdapterForTests(): ProviderAdapter {
  const amadeus = createMockAmadeusAdapter()
  return createProviderAdapter({
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
        })),
      }
    },
  })
}
