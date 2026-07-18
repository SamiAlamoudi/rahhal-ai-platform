import { describe, it, expect } from 'vitest'
import {
  buildDestinationAwareFlightOffers,
  buildDestinationAwareHotelOffers,
  buildDestinationAwareActivityOffers,
  buildDestinationAwareTransferOffers,
  buildDestinationAwareInsight,
  buildDestinationAwareFlightSearchResults,
  buildDestinationAwareHotelSearchResults,
  buildDestinationAwareActivitySearchResults,
  resolveDestinationProfile,
} from '../mocks/destinationAwareMocks'
import { buildTravelSearchRequest } from '../travelSearchRequest'
import {
  createEmptyTravelSession,
  mergeTravelSession,
  confirmDecisionProfile,
} from '../travelSession'
import { orchestrateMockSearch, MOCK_PROVIDERS } from '../searchOrchestrator'
import { createMockContractProviders } from '../contracts'

function makeRequest(messages: string[]) {
  let session = createEmptyTravelSession()
  for (const msg of messages) {
    session = mergeTravelSession(session, msg)
  }
  session = confirmDecisionProfile(session)
  return buildTravelSearchRequest(session)
}

describe('destination-aware mock recommendations', () => {
  it('generates Morocco flights from Riyadh (not Tokyo)', () => {
    const req = makeRequest([
      'أريد السفر إلى المغرب لمدة 10 أيام وميزانيتي 10000 ريال',
      'من الرياض',
      '15 أكتوبر',
    ])
    expect(req.destination).toBe('Morocco')
    expect(req.departureCity).toBe('Riyadh')

    const flights = buildDestinationAwareFlightOffers(req)
    expect(flights.length).toBeGreaterThan(0)
    for (const flight of flights) {
      expect(flight.title).toMatch(/Marrakech|Morocco|RAK/i)
      expect(flight.title).not.toMatch(/Tokyo|طوكيو|NRT|HND|Japan/i)
      expect(flight.itinerary.segments[0]?.origin).toBe('RUH')
      expect(flight.itinerary.segments[0]?.destination).toBe('RAK')
    }
  })

  it('keeps hotels and activities inside the requested destination', () => {
    const req = makeRequest([
      'أريد السفر إلى المغرب لمدة 10 أيام وميزانيتي 10000 ريال',
      'من الرياض',
      '15 أكتوبر',
    ])

    const hotels = buildDestinationAwareHotelOffers(req)
    const activities = buildDestinationAwareActivityOffers(req)
    const transfers = buildDestinationAwareTransferOffers(req)
    const insight = buildDestinationAwareInsight(req)

    expect(hotels.every((h) => /Marrakech|Morocco/i.test(h.location))).toBe(true)
    expect(hotels.some((h) => /Tokyo|Japan|Odaiba|Shinjuku/i.test(h.title))).toBe(false)

    expect(activities.every((a) => a.destination === 'Marrakech')).toBe(true)
    expect(activities.some((a) => /Tokyo|Fuji|Disneyland/i.test(a.title))).toBe(false)

    expect(transfers.every((t) => /Marrakech|RAK/i.test(`${t.origin} ${t.destination} ${t.location}`))).toBe(true)
    expect(insight.country).toBe('Morocco')
    expect(insight.destination).toBe('Morocco')
  })

  it('orchestrator ranked cards reflect Morocco, never Tokyo', () => {
    const req = makeRequest([
      'أريد السفر إلى المغرب لمدة 10 أيام وميزانيتي 10000 ريال',
      'من الرياض',
      '15 أكتوبر',
    ])
    const result = orchestrateMockSearch(req, MOCK_PROVIDERS)
    expect(result.rankedOptions.length).toBeGreaterThan(0)

    const blob = result.rankedOptions
      .map((o) => `${o.title} ${o.location ?? ''}`)
      .join(' | ')

    expect(blob).toMatch(/Marrakech|Morocco|RAK/i)
    expect(blob).not.toMatch(/Tokyo|طوكيو|Narita|Disneyland|Mount Fuji|Odaiba|Shinjuku/i)

    const flights = buildDestinationAwareFlightSearchResults(req)
    const hotels = buildDestinationAwareHotelSearchResults(req)
    const activities = buildDestinationAwareActivitySearchResults(req)
    expect(flights[0]?.rawMetadata.origin).toBe('RUH')
    expect(flights[0]?.rawMetadata.destination).toBe('RAK')
    expect(hotels[0]?.location).toMatch(/Marrakech/i)
    expect(activities[0]?.rawMetadata.destination).toBe('Marrakech')
  })

  it('still produces Japan-themed mocks when Japan is requested', () => {
    const req = makeRequest([
      'أريد السفر إلى اليابان لمدة 10 أيام مع زوجتي وطفلين وميزانيتي 20 ألف ريال.',
      'من الرياض',
      '15 أكتوبر',
    ])
    expect(req.destination).toBe('Japan')
    const hotels = buildDestinationAwareHotelOffers(req)
    const activities = buildDestinationAwareActivityOffers(req)
    expect(hotels[0]?.location).toMatch(/Tokyo/i)
    expect(activities[0]?.destination).toBe('Tokyo')
    expect(resolveDestinationProfile('Japan').country).toBe('Japan')
  })

  it('contract mock providers use the parsed destination', async () => {
    const req = makeRequest([
      'أريد السفر إلى المغرب لمدة 10 أيام وميزانيتي 10000 ريال',
      'من الرياض',
      '15 أكتوبر',
    ])
    const providers = createMockContractProviders()
    const flights = await providers.flight.searchFlights({ search: req })
    const hotels = await providers.hotel.searchHotels({ search: req })
    const activities = await providers.activity.searchActivities({ search: req })
    const insight = await providers.destination.getDestinationInsight({ search: req })

    expect(flights.data?.[0]?.itinerary.segments[0]?.destination).toBe('RAK')
    expect(hotels.data?.[0]?.location).toMatch(/Marrakech/i)
    expect(activities.data?.[0]?.destination).toBe('Marrakech')
    expect(insight.data?.country).toBe('Morocco')
  })
})
