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
    expect(e1.retryable).toBe(false)

    // Preserve plain string / object.message; Unknown error is fallback only.
    const e2 = fromThrown('string error', 'p1')
    expect(e2.message).toBe('string error')
    expect(e2.category).toBe('unknown')

    const e3 = fromThrown({ message: 'obj error' }, 'p1')
    expect(e3.message).toBe('obj error')

    const e4 = fromThrown(null, 'p1')
    expect(e4.message).toBe('Unknown error')
  })
})

describe('Contracts: capabilities', () => {
  it('defaultCapabilities has all standard features', () => {
    const caps = defaultCapabilities()
    expect(caps.supportsRealtime).toBe(false)
    expect(caps.supportsBooking).toBe(false)
    expect(caps.supportsCancellation).toBe(false)
    expect(caps.supportsPriceTracking).toBe(false)
    expect(caps.supportsMultiCity).toBe(false)
    expect(caps.supportsCalendarSearch).toBe(false)
    expect(caps.offersMaxResults).toBeGreaterThanOrEqual(10)
    expect(caps.supportsRealTimePricing).toBe(true)
    expect(caps.supportsFreeCancellation).toBe(true)
    expect(caps.supportsFamilyFriendly).toBe(true)
    expect(caps.supportsFlexibleDates).toBe(true)
  })
})

describe('Contracts: registry', () => {
  it('createDefaultContractRegistry registers flight/hotel/activity/transfer providers', () => {
    const reg = createDefaultContractRegistry()
    const flightIds = reg.getByDomain('flight').map(p => p.metadata.id)
    expect(flightIds).toContain('mock-flight-001')
    expect(reg.getByDomain('hotel').length).toBeGreaterThan(0)
    expect(reg.getByDomain('activity').length).toBeGreaterThan(0)
    expect(reg.getByDomain('transfer').length).toBeGreaterThan(0)

    // Legacy array shape remains available for backward-compatible callers.
    expect(reg.flights.map(p => p.metadata.id)).toContain('mock-flight-001')
    expect(reg.hotels.length).toBeGreaterThan(0)
    expect(reg.activities.length).toBeGreaterThan(0)
    expect(reg.transfers.length).toBeGreaterThan(0)
  })
})

describe('Contracts: sampleOffers (flight/hotel/activity/transfer)', () => {
  it('exposes sync sampleOffers for flight/hotel/activity/transfer mocks', () => {
    const req = makeRequest()
    const providers = createMockContractProviders()

    const flightOffers = providers.flight.sampleOffers(req)
    expect(Array.isArray(flightOffers)).toBe(true)
    expect(flightOffers.length).toBeGreaterThan(0)
    expect(flightOffers[0].price).toBeGreaterThan(0)
    expect(flightOffers[0].currency).toBeTruthy()
    expect(flightOffers[0].itinerary.segments.length).toBeGreaterThan(0)

    const hotelOffers = providers.hotel.sampleOffers(req)
    expect(hotelOffers.length).toBeGreaterThan(0)
    expect(hotelOffers[0].price).toBeGreaterThan(0)
    expect(hotelOffers[0].hotelStars).toBeGreaterThan(0)
    expect(hotelOffers[0].location).toBeTruthy()

    const activityOffers = providers.activity.sampleOffers(req)
    expect(activityOffers.length).toBeGreaterThan(0)
    expect(activityOffers[0].price).toBeGreaterThan(0)
    expect(activityOffers[0].durationMinutes).toBeGreaterThan(0)

    const transferOffers = providers.transfer.sampleOffers(req)
    expect(transferOffers.length).toBeGreaterThan(0)
    expect(transferOffers[0].price).toBeGreaterThan(0)
    expect(transferOffers[0].transferType).toBeTruthy()
  })

  it('maps sampleOffers into SearchResult via offer mappers', () => {
    const req = makeRequest()
    const providers = createMockContractProviders()

    const flightSr = flightOfferToSearchResult(providers.flight.sampleOffers(req)[0])
    expect(flightSr.providerType).toBe('flight')
    expect(flightSr.price).toBeGreaterThan(0)
    expect(flightSr.location).toContain('→')

    const hotelSr = hotelOfferToSearchResult(providers.hotel.sampleOffers(req)[0])
    expect(hotelSr.providerType).toBe('hotel')
    expect(hotelSr.rawMetadata.hotelStars).toBeGreaterThan(0)

    const activitySr = activityOfferToSearchResult(providers.activity.sampleOffers(req)[0])
    expect(activitySr.providerType).toBe('activity')
    expect(activitySr.durationMinutes).toBeGreaterThan(0)

    const transferSr = transferOfferToSearchResult(providers.transfer.sampleOffers(req)[0])
    expect(transferSr.providerType).toBe('transportation')
    expect(transferSr.rawMetadata.transportType).toBeTruthy()
  })
})

describe('Contracts: offer -> SearchResult mappers', () => {
  it('flightOfferToSearchResult maps required fields', async () => {
    const req = makeRequest()
    const providers = createMockContractProviders()
    const result = await providers.flight.searchFlights(req)
    const offer = result.data![0]
    const sr = flightOfferToSearchResult(offer)
    expect(sr.providerType).toBe('flight')
    expect(sr.price).toBe(offer.price)
    expect(sr.title).toBe(offer.title)
    expect(sr.currency).toBe(offer.currency)
    expect(sr.externalId).toBe(offer.id)
    expect(sr.location).toContain('→')
  })

  it('hotelOfferToSearchResult maps required fields', async () => {
    const req = makeRequest()
    const providers = createMockContractProviders()
    const result = await providers.hotel.searchHotels(req)
    const offer = result.data![0]
    const sr = hotelOfferToSearchResult(offer)
    expect(sr.providerType).toBe('hotel')
    expect(sr.price).toBe(offer.price)
    expect(sr.location).toBe(offer.location)
    expect(sr.rawMetadata.hotelStars).toBe(offer.hotelStars)
  })

  it('activityOfferToSearchResult maps required fields', async () => {
    const req = makeRequest()
    const providers = createMockContractProviders()
    const result = await providers.activity.searchActivities(req)
    const offer = result.data![0]
    const sr = activityOfferToSearchResult(offer)
    expect(sr.providerType).toBe('activity')
    expect(sr.price).toBe(offer.price)
    expect(sr.durationMinutes).toBe(offer.durationMinutes)
  })

  it('transferOfferToSearchResult maps required fields', async () => {
    const req = makeRequest()
    const providers = createMockContractProviders()
    const result = await providers.transfer.searchTransfers(req)
    const offer = result.data![0]
    const sr = transferOfferToSearchResult(offer)
    expect(sr.providerType).toBe('transportation')
    expect(sr.price).toBe(offer.price)
    expect(sr.rawMetadata.transportType).toBe(offer.transferType)
  })
})

describe('Contracts: contractToAdapterAsync', () => {
  it('flight adapter returns mapped search results', async () => {
    const req = makeRequest()
    const providers = createMockContractProviders()
    const results = await contractToAdapterAsync(providers.flight, req.search)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].providerType).toBe('flight')
    expect(results[0].price).toBeGreaterThan(0)
  })

  it('hotel adapter returns mapped search results', async () => {
    const req = makeRequest()
    const providers = createMockContractProviders()
    const results = await contractToAdapterAsync(providers.hotel, req.search)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].providerType).toBe('hotel')
  })

  it('activity adapter returns mapped search results', async () => {
    const req = makeRequest()
    const providers = createMockContractProviders()
    const results = await contractToAdapterAsync(providers.activity, req.search)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].providerType).toBe('activity')
  })

  it('transfer adapter returns mapped search results', async () => {
    const req = makeRequest()
    const providers = createMockContractProviders()
    const results = await contractToAdapterAsync(providers.transfer, req.search)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].providerType).toBe('transportation')
  })

  it('adapter sets providerName from metadata', async () => {
    const req = makeRequest()
    const providers = createMockContractProviders()
    const results = await contractToAdapterAsync(providers.flight, req.search)
    expect(results[0].providerName).toBe(providers.flight.metadata.name)
  })
})
