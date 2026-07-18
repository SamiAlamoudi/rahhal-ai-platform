import { describe, expect, it } from 'vitest'
import {
  mapOptionToBookingType,
  resolveBookingUrl,
  resolveProviderName,
  toBookingSelectedItem,
  toBookingSelectedItems,
} from '../booking/bookingSelectionMapper'
import type { NormalizedTravelOption } from '../../utils/searchOrchestrator'

function option(overrides: Partial<NormalizedTravelOption> = {}): NormalizedTravelOption {
  return {
    id: 'opt-1',
    type: 'flight',
    title: 'RUH → DXB',
    providerIds: ['amadeus-flight'],
    price: 900,
    currency: 'SAR',
    durationMinutes: 120,
    stops: 0,
    rating: 4.5,
    location: 'DXB',
    baggageIncluded: true,
    familyFriendly: true,
    refundable: true,
    attributes: {},
    decisionScore: null,
    recommendationLevel: null,
    reasons: [],
    ...overrides,
  }
}

describe('bookingSelectionMapper', () => {
  it('maps normalized types to booking item types', () => {
    expect(mapOptionToBookingType(option({ type: 'flight' }))).toBe('flight')
    expect(mapOptionToBookingType(option({ type: 'hotel' }))).toBe('hotel')
    expect(mapOptionToBookingType(option({ type: 'activity' }))).toBe('activity')
    expect(mapOptionToBookingType(option({ type: 'transportation' }))).toBe('rental_car')
  })

  it('prefers safe bookingUrl from attributes and falls back safely', () => {
    expect(
      resolveBookingUrl(
        option({
          attributes: { bookingUrl: 'https://www.amadeus.com/book/abc' },
        }),
      ),
    ).toBe('https://www.amadeus.com/book/abc')

    expect(resolveBookingUrl(option({ attributes: { bookingUrl: 'javascript:alert(1)' } }))).toMatch(
      /^https:\/\/www\.example\.com\/book\//,
    )
    expect(resolveBookingUrl(option())).toMatch(/^https:\/\/www\.example\.com\/book\//)
  })

  it('builds review selection payloads for the funnel hop', () => {
    const selected = toBookingSelectedItem(
      option({
        id: 'flight-9',
        providerIds: ['amadeus-flight'],
        attributes: { bookingUrl: 'https://www.amadeus.com/book/9' },
      }),
    )
    expect(selected.bookingType).toBe('flight')
    expect(selected.providerName).toBe('Amadeus')
    expect(selected.bookingUrl).toBe('https://www.amadeus.com/book/9')
    expect(selected.cancellationInfo).toContain('إلغاء')

    const multi = toBookingSelectedItems([
      option({ id: 'a', type: 'flight' }),
      option({ id: 'b', type: 'hotel', providerIds: ['booking-com'], title: 'Hilton' }),
    ])
    expect(multi).toHaveLength(2)
    expect(resolveProviderName(option({ providerIds: ['booking-com'] }))).toBe('Booking.com')
    expect(resolveProviderName(option({ providerIds: ['amadeus-flight-001'] }))).toBe('Amadeus')
  })

  it('uses Amadeus sandbox bookingUrl from attributes for funnel handoff', () => {
    const selected = toBookingSelectedItem(
      option({
        providerIds: ['amadeus-flight-001'],
        attributes: {
          bookingUrl: 'https://www.amadeus.com/book/flights?offerId=offer-1&source=rahhal&env=sandbox',
          providerName: 'Amadeus Flights',
        },
      }),
    )
    expect(selected.providerName).toBe('Amadeus Flights')
    expect(selected.bookingUrl).toContain('offerId=offer-1')
    expect(selected.bookingUrl).toContain('env=sandbox')
  })
})
