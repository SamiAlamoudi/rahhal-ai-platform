import { describe, it, expect } from 'vitest'
import {
  createMockContractProviders,
  createDefaultContractRegistry,
  okResult,
  errorResult,
  fromThrown,
  defaultCapabilities,
  flightOfferToSearchResult,
  hotelOfferToSearchResult,
  activityOfferToSearchResult,
  transferOfferToSearchResult,
  contractToAdapterAsync,
  type ProviderRequest,
} from '../index'
import { buildTravelSearchRequest } from '../../travelSearchRequest'
import { createEmptyTravelSession, mergeTravelSession, confirmDecisionProfile } from '../../travelSession'

const MSG1 = 'أريد السفر إلى اليابان لمدة 10 أيام مع زوجتي وطفلين وميزانيتي 20 ألف ريال.'

function makeRequest(): ProviderRequest {
  let s = mergeTravelSession(createEmptyTravelSession(), MSG1)
  s = mergeTravelSession(s, 'من الرياض')
  s = mergeTravelSession(s, '15 أكتوبر')
  s = confirmDecisionProfile(s)
  return { search: buildTravelSearchRequest(s) }
}

describe('Contracts: ProviderResult wrapper', () => {
  it('okResult builds a success result with data', () => {
    const r = okResult('p1', 'Provider 1', [1, 2, 3], 42, 'mock')
    expect(r.success).toBe(true)
    expect(r.data).toEqual([1, 2, 3])
    expect(r.latency).toBe(42)
    expect(r.source).toBe('mock')
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
  })

  it('errorResult builds a failure result with null data', () => {
    const r = errorResult<number[]>('p1', 'Provider 1', [{
      code: 'TIMEOUT',
      category: 'timeout',
      severity: 'error',
      message: 'Request timed out',
      retryable: true,
      timestamp: new Date().toISOString(),
    }], 5000, 'amadeus')
    expect(r.success).toBe(false)
    expect(r.data).toBeNull()
    expect(r.errors.length).toBe(1)
    expect(r.errors[0].category).toBe('timeout')
    expect(r.errors[0].retryable).toBe(true)
  })

  it('fromThrown converts unknown thrown value to ProviderError', () => {
    const e1 = fromThrown(new Error('boom'), 'p1')
    expect(e1.message).toBe('boom')
    expect(e1.category).toBe('unknown')

    const e2 = fromThrown('string error', 'p1')
    expect(e2.message).toBe('Unknown error')
    expect(e2.code).toBe('UNCAUGHT')
  })
})

describe('Contracts: default capabilities', () => {
  it('all flags default to false', () => {
    const caps = defaultCapabilities()
    expect(caps.supportsRealtime).toBe(false)
    expect(caps.supportsBooking).toBe(false)
    expect(caps.supportsCancellation).toBe(false)
    expect(caps.supportsPriceTracking).toBe(false)
    expect(caps.supportsMultiCity).toBe(false)
    expect(caps.supportsCalendarSearch).toBe(false)
  })
})

describe('Contracts: mock flight provider', () => {
  it('returns success with 3 flight offers matching existing mock data', async () => {
    const mocks = createMockContractProviders()
    const result = await mocks.flight.searchFlights(makeRequest())
    expect(result.success).toBe(true)
    expect(result.data).not.toBeNull()
    expect(result.data!.length).toBe(3)
    expect(result.data![0].id).toBe('JAL-462')
    expect(result.data![0].price).toBe(8500)
    expect(result.data![0].currency).toBe('SAR')
    expect(result.data![0].itinerary.stops).toBe(0)
    expect(result.data![0].itinerary.segments[0].cabin).toBe('business')
    expect(result.data![1].id).toBe('QR-1166')
    expect(result.data![1].price).toBe(5500)
    expect(result.data![2].id).toBe('SV-842')
    expect(result.data![2].price).toBe(4800)
  })

  it('has correct metadata and capabilities', () => {
    const mocks = createMockContractProviders()
    const meta = mocks.flight.metadata
    expect(meta.id).toBe('mock-flight-001')
    expect(meta.type).toBe('flight')
    expect(meta.version).toBe('1.0.0')
    expect(meta.enabled).toBe(true)
    const caps = mocks.flight.getCapabilities()
    expect(caps.supportsCancellation).toBe(true)
    expect(caps.supportsPriceTracking).toBe(true)
  })
})

describe('Contracts: mock hotel provider', () => {
  it('returns success with 3 hotel offers matching existing mock data', async () => {
    const mocks = createMockContractProviders()
    const result = await mocks.hotel.searchHotels(makeRequest())
    expect(result.success).toBe(true)
    expect(result.data!.length).toBe(3)
    expect(result.data![0].id).toBe('HILTON-TOKYO-SHINJUKU')
    expect(result.data![0].price).toBe(850)
    expect(result.data![0].hotelStars).toBe(5)
    expect(result.data![1].id).toBe('COURTYARD-SHINJUKU')
    expect(result.data![2].id).toBe('TOYOKO-INN-ASAKUSA')
  })
})

describe('Contracts: mock activity provider', () => {
  it('returns success with 3 activity offers matching existing mock data', async () => {
    const mocks = createMockContractProviders()
    const result = await mocks.activity.searchActivities(makeRequest())
    expect(result.success).toBe(true)
    expect(result.data!.length).toBe(3)
    expect(result.data![0].id).toBe('DISNEYLAND-TOKYO')
    expect(result.data![0].price).toBe(600)
    expect(result.data![1].id).toBe('MT-FUJI-TOUR')
    expect(result.data![2].id).toBe('TOKYO-CITY-TOUR')
  })
})

describe('Contracts: mock transfer provider', () => {
  it('returns success with 2 transfer offers matching existing mock data', async () => {
    const mocks = createMockContractProviders()
    const result = await mocks.transfer.searchTransfers(makeRequest())
    expect(result.success).toBe(true)
    expect(result.data!.length).toBe(2)
    expect(result.data![0].id).toBe('NARITA-EXPRESS')
    expect(result.data![0].price).toBe(120)
    expect(result.data![0].transferType).toBe('train')
    expect(result.data![1].id).toBe('PRIVATE-TRANSFER-TOKYO')
  })
})

describe('Contracts: mock visa provider', () => {
  it('returns success with visa info for destination', async () => {
    const mocks = createMockContractProviders()
    const result = await mocks.visa.getVisaInfo(makeRequest())
    expect(result.success).toBe(true)
    expect(result.data).not.toBeNull()
    expect(result.data!.required).toBe(true)
    expect(result.data!.processingDays).toBeGreaterThan(0)
    expect(result.data!.documentsRequired.length).toBeGreaterThan(0)
  })
})

describe('Contracts: mock weather provider', () => {
  it('returns success with weather forecasts', async () => {
    const mocks = createMockContractProviders()
    const result = await mocks.weather.getWeatherInfo(makeRequest())
    expect(result.success).toBe(true)
    expect(result.data).not.toBeNull()
    expect(result.data!.forecasts.length).toBeGreaterThan(0)
    expect(result.data!.bestSeason.length).toBeGreaterThan(0)
  })
})

describe('Contracts: mock destination provider', () => {
  it('returns success with destination insights', async () => {
    const mocks = createMockContractProviders()
    const result = await mocks.destination.getDestinationInsight(makeRequest())
    expect(result.success).toBe(true)
    expect(result.data).not.toBeNull()
    expect(result.data!.pointsOfInterest.length).toBeGreaterThan(0)
    expect(result.data!.travelTips.length).toBeGreaterThan(0)
  })
})

describe('Contracts: bridge to ProviderSearchResult', () => {
  it('converts FlightOffer to ProviderSearchResult with matching price and type', async () => {
    const mocks = createMockContractProviders()
    const result = await mocks.flight.searchFlights(makeRequest())
    const offer = result.data![0]
    const sr = flightOfferToSearchResult(offer)
    expect(sr.providerType).toBe('flight')
    expect(sr.externalId).toBe('JAL-462')
    expect(sr.price).toBe(8500)
    expect(sr.currency).toBe('SAR')
    expect(sr.stops).toBe(0)
    expect(sr.rawMetadata.airline).toBe('JAL')
    expect(sr.rawMetadata.cabin).toBe('business')
  })

  it('converts HotelOffer to ProviderSearchResult with matching price and type', async () => {
    const mocks = createMockContractProviders()
    const result = await mocks.hotel.searchHotels(makeRequest())
    const offer = result.data![0]
    const sr = hotelOfferToSearchResult(offer)
    expect(sr.providerType).toBe('hotel')
    expect(sr.externalId).toBe('HILTON-TOKYO-SHINJUKU')
    expect(sr.price).toBe(850)
    expect(sr.rawMetadata.hotelStars).toBe(5)
  })

  it('converts ActivityOffer to ProviderSearchResult with matching price and type', async () => {
    const mocks = createMockContractProviders()
    const result = await mocks.activity.searchActivities(makeRequest())
    const offer = result.data![0]
    const sr = activityOfferToSearchResult(offer)
    expect(sr.providerType).toBe('activity')
    expect(sr.externalId).toBe('DISNEYLAND-TOKYO')
    expect(sr.price).toBe(600)
    expect(sr.rawMetadata.activityType).toBe('entertainment')
  })

  it('converts TransferOffer to ProviderSearchResult as transportation type', async () => {
    const mocks = createMockContractProviders()
    const result = await mocks.transfer.searchTransfers(makeRequest())
    const offer = result.data![0]
    const sr = transferOfferToSearchResult(offer)
    expect(sr.providerType).toBe('transportation')
    expect(sr.externalId).toBe('NARITA-EXPRESS')
    expect(sr.price).toBe(120)
    expect(sr.rawMetadata.transportType).toBe('train')
  })
})

describe('Contracts: contractToAdapterAsync', () => {
  it('bridges flight contract provider to ProviderSearchResult[] matching existing mock data', async () => {
    const mocks = createMockContractProviders()
    const req = makeRequest().search
    const results = await contractToAdapterAsync(mocks.flight, req)
    expect(results.length).toBe(3)
    expect(results[0].providerType).toBe('flight')
    expect(results[0].providerName).toBe('Mock Flight Provider')
    expect(results[0].price).toBe(8500)
    expect(results[0].rawMetadata.cabin).toBe('business')
  })

  it('bridges hotel contract provider to ProviderSearchResult[]', async () => {
    const mocks = createMockContractProviders()
    const req = makeRequest().search
    const results = await contractToAdapterAsync(mocks.hotel, req)
    expect(results.length).toBe(3)
    expect(results[0].providerType).toBe('hotel')
    expect(results[0].price).toBe(850)
  })
})

describe('Contracts: contract registry', () => {
  it('registers all 7 mock providers', () => {
    const registry = createDefaultContractRegistry()
    expect(registry.listAll().length).toBe(7)
  })

  it('lists enabled providers', () => {
    const registry = createDefaultContractRegistry()
    expect(registry.listEnabled().length).toBe(7)
  })

  it('filters by domain', () => {
    const registry = createDefaultContractRegistry()
    const flights = registry.getByDomain('flight')
    expect(flights.length).toBe(1)
    expect(flights[0].metadata.type).toBe('flight')
  })

  it('disables and enables a provider', () => {
    const registry = createDefaultContractRegistry()
    expect(registry.disable('mock-flight-001')).toBe(true)
    expect(registry.listEnabled().length).toBe(6)
    expect(registry.enable('mock-flight-001')).toBe(true)
    expect(registry.listEnabled().length).toBe(7)
  })

  it('retrieves metadata by id', () => {
    const registry = createDefaultContractRegistry()
    const meta = registry.getMetadata('mock-hotel-001')
    expect(meta).not.toBeNull()
    expect(meta!.type).toBe('hotel')
    expect(meta!.version).toBe('1.0.0')
  })

  it('returns null for unknown id', () => {
    const registry = createDefaultContractRegistry()
    expect(registry.getById('nonexistent')).toBeNull()
    expect(registry.getMetadata('nonexistent')).toBeNull()
  })
})
