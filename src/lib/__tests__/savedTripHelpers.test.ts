import { describe, it, expect } from 'vitest'
import {
  buildSavedTripData,
  buildSavedTripTitle,
  filterSavedTrips,
  formatSavedTripTotal,
  parseSavedTripData,
} from '../savedTrips/savedTripHelpers'
import type { SavedTripRow } from '../types'

function trip(partial: Partial<SavedTripRow> & Pick<SavedTripRow, 'id' | 'title' | 'destination'>): SavedTripRow {
  return {
    user_id: 'u1',
    session_id: null,
    trip_data: {},
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...partial,
  }
}

describe('savedTripHelpers', () => {
  it('buildSavedTripTitle includes destination and item count', () => {
    expect(buildSavedTripTitle('طوكيو', 2)).toBe('طوكيو · 2 عنصر')
    expect(buildSavedTripTitle('  ', 0)).toBe('رحلة محفوظة')
  })

  it('buildSavedTripData snapshots items and total', () => {
    const data = buildSavedTripData({
      currency: 'SAR',
      travelSessionId: 'sess-1',
      bookingSessionId: 'book-1',
      items: [
        { type: 'flight', title: 'RUH→NRT', providerName: 'Amadeus', price: 1200, currency: 'SAR' },
        { type: 'hotel', title: 'Hilton', providerName: 'Booking', price: 800, currency: 'SAR', bookingUrl: 'https://example.com' },
      ],
    })
    expect(data.items).toHaveLength(2)
    expect(data.total).toBe(2000)
    expect(data.savedFrom).toBe('booking_review')
    expect(data.items[1].bookingUrl).toBe('https://example.com')
  })

  it('parseSavedTripData tolerates malformed payloads', () => {
    const data = parseSavedTripData({
      currency: 'USD',
      items: [
        { title: 'Only title' },
        null,
        { type: 'flight', title: 'Flight', providerName: 'X', price: 10 },
      ],
      savedFrom: 'import',
    })
    expect(data.currency).toBe('USD')
    expect(data.items).toHaveLength(2)
    expect(data.items[0].price).toBe(0)
    expect(data.total).toBe(10)
    expect(data.savedFrom).toBe('import')
  })

  it('filterSavedTrips matches title and destination', () => {
    const rows = [
      trip({ id: '1', title: 'رحلة طوكيو', destination: 'Japan' }),
      trip({ id: '2', title: 'دبي فاخرة', destination: 'Dubai' }),
    ]
    expect(filterSavedTrips(rows, 'tokyo')).toHaveLength(0)
    expect(filterSavedTrips(rows, 'دبي')).toHaveLength(1)
    expect(filterSavedTrips(rows, 'japan')).toHaveLength(1)
    expect(filterSavedTrips(rows, '  ')).toHaveLength(2)
  })

  it('formatSavedTripTotal returns null without total', () => {
    expect(formatSavedTripTotal(parseSavedTripData({}))).toBeNull()
    expect(formatSavedTripTotal(buildSavedTripData({
      currency: 'SAR',
      travelSessionId: null,
      bookingSessionId: null,
      items: [{ type: 'flight', title: 'A', providerName: 'B', price: 50, currency: 'SAR' }],
    }))).toBe('50 SAR')
  })
})
