import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BookingOrchestrator } from '../booking/bookingOrchestrator'
import {
  flightOfferToBookingItemInput,
  hotelOfferToBookingItemInput,
  formatTravelerSummary,
} from '../booking/bookingOfferMappers'
import {
  createTripBookingSession,
  confirmTripBookingSelection,
  bookingSessionFromRow,
} from '../booking/bookingSessionService'
import type { FlightOffer } from '../../utils/contracts/models/flight'
import type { HotelOffer } from '../../utils/contracts/models/hotel'
import type { TripTravelSummary } from '../../utils/tripPlanner'
import type { BookingSessionRow } from '../types'

vi.mock('../repositories/bookingSessionRepository', () => ({
  bookingSessionRepository: {
    create: vi.fn(async (input: { id?: string }) => ({
      id: input.id ?? 'sess-1',
      user_id: 'user-1',
      travel_session_id: null,
      status: 'selected',
      items: [],
      subtotal: 9700,
      fees: 0,
      total: 9700,
      currency: 'SAR',
      selected_booking_mode: 'redirect',
      provider_references: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      redirected_at: null,
      confirmed_at: null,
    })),
    update: vi.fn(async (id: string, updates: Record<string, unknown>) => ({
      id,
      user_id: 'user-1',
      travel_session_id: null,
      status: updates.status ?? 'selected',
      items: [],
      subtotal: 9700,
      fees: 0,
      total: 9700,
      currency: 'SAR',
      selected_booking_mode: 'redirect',
      provider_references: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      redirected_at: null,
      confirmed_at: updates.confirmed_at ?? null,
    })),
    getById: vi.fn(async () => null),
    listByUser: vi.fn(async () => []),
    delete: vi.fn(async () => true),
  },
}))

vi.mock('../repositories/bookingItemRepository', () => ({
  bookingItemRepository: {
    create: vi.fn(async (input: { id?: string; booking_session_id: string }) => ({
      id: input.id ?? 'item-1',
      booking_session_id: input.booking_session_id,
      user_id: 'user-1',
      type: 'flight',
      provider_id: 'amadeus-flight-001',
      provider_name: 'Amadeus',
      provider_offer_id: 'SV-100',
      title: 'SV 100',
      price: 4200,
      currency: 'SAR',
      booking_url: '',
      booking_mode: 'redirect',
      expires_at: null,
      traveler_summary: '2 adults, 1 children',
      selected_at: new Date().toISOString(),
      metadata: {},
    })),
    listBySession: vi.fn(async () => []),
    delete: vi.fn(async () => true),
    deleteBySession: vi.fn(async () => true),
  },
}))

vi.mock('../repositories/bookingEventRepository', () => ({
  bookingEventRepository: {
    create: vi.fn(async () => ({
      id: 'evt-1',
      booking_session_id: 'sess-1',
      user_id: 'user-1',
      event_type: 'items_selected',
      from_status: 'draft',
      to_status: 'selected',
      details: {},
      created_at: new Date().toISOString(),
    })),
    listBySession: vi.fn(async () => []),
    listByUser: vi.fn(async () => []),
  },
}))

const summary: TripTravelSummary = {
  origin: 'الرياض',
  destination: 'طوكيو',
  departureDate: '2026-10-15',
  returnDate: '2026-10-25',
  nights: 10,
  durationDays: 10,
  travelers: { adults: 2, children: 1, infants: 0, total: 3 },
  currency: 'SAR',
  budgetAmount: 20000,
}

function sampleFlight(overrides: Partial<FlightOffer> = {}): FlightOffer {
  return {
    id: 'SV-100',
    providerId: 'amadeus-flight-001',
    title: 'SV 100',
    currency: 'SAR',
    price: 4200,
    originalPrice: null,
    rating: 4,
    familyFriendly: true,
    cancellationPolicy: null,
    itinerary: {
      segments: [{
        origin: 'RUH',
        destination: 'NRT',
        departure: '2026-10-15T08:00',
        arrival: '2026-10-15T22:00',
        carrier: 'SV',
        flightNumber: 'SV100',
        aircraft: null,
        cabin: 'economy',
        durationMinutes: 840,
      }],
      totalDuration: 840,
      stops: 0,
      refundable: true,
      baggageIncluded: true,
    },
    ...overrides,
  }
}

function sampleHotel(overrides: Partial<HotelOffer> = {}): HotelOffer {
  return {
    id: 'HTL-1',
    providerId: 'booking-hotel-001',
    title: 'Tokyo Hotel',
    currency: 'SAR',
    price: 5500,
    originalPrice: null,
    rating: 4.5,
    hotelStars: 4,
    location: 'Tokyo',
    area: 'Shinjuku',
    checkIn: '2026-10-15',
    checkOut: '2026-10-25',
    familyFriendly: true,
    breakfastIncluded: true,
    freeCancellation: true,
    amenities: [],
    roomTypes: [],
    ...overrides,
  }
}

describe('bookingOfferMappers', () => {
  it('formats traveler summary and maps flight/hotel offers', () => {
    expect(formatTravelerSummary(summary)).toContain('2 adults')
    const flight = flightOfferToBookingItemInput(sampleFlight(), summary)
    const hotel = hotelOfferToBookingItemInput(sampleHotel(), summary)
    expect(flight.type).toBe('flight')
    expect(flight.metadata.departureDate).toBe('2026-10-15')
    expect(hotel.type).toBe('hotel')
    expect(hotel.metadata.checkIn).toBe('2026-10-15')
    expect(hotel.metadata.checkOut).toBe('2026-10-25')
  })
})

describe('BookingOrchestrator.confirmSelection', () => {
  it('requires one flight and one hotel then sets confirmedAt', () => {
    const orch = new BookingOrchestrator()
    const session = orch.createBookingSession({
      userId: 'user-1',
      travelSessionId: null,
      currency: 'SAR',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    orch.addBookingItem(session.id, flightOfferToBookingItemInput(sampleFlight(), summary))
    const early = orch.confirmSelection(session.id)
    expect(early?.confirmedAt).toBeNull()
    expect(orch.getLastError()).toContain('flight and one hotel')

    orch.addBookingItem(session.id, hotelOfferToBookingItemInput(sampleHotel(), summary))
    const confirmed = orch.confirmSelection(session.id)
    expect(confirmed?.confirmedAt).toBeTruthy()
    expect(confirmed?.status).toBe('selected')
    expect(confirmed?.total).toBe(9700)
  })
})

describe('createTripBookingSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates in-memory session with flight+hotel and persists when enabled', async () => {
    const orch = new BookingOrchestrator()
    const result = await createTripBookingSession({
      userId: '11111111-1111-4111-8111-111111111111',
      travelSessionId: null,
      flight: sampleFlight(),
      hotel: sampleHotel(),
      summary,
      orchestrator: orch,
      persist: true,
    })

    expect(result.error).toBeNull()
    expect(result.persisted).toBe(true)
    expect(result.session?.items).toHaveLength(2)
    expect(result.session?.total).toBe(9700)
    expect(result.session?.items.some((i) => i.type === 'flight')).toBe(true)
    expect(result.session?.items.some((i) => i.type === 'hotel')).toBe(true)
  })

  it('can skip persistence for local-only drafts', async () => {
    const orch = new BookingOrchestrator()
    const result = await createTripBookingSession({
      userId: 'user-1',
      travelSessionId: null,
      flight: sampleFlight(),
      hotel: sampleHotel(),
      summary,
      orchestrator: orch,
      persist: false,
    })
    expect(result.persisted).toBe(false)
    expect(result.session?.items).toHaveLength(2)
  })
})

describe('confirmTripBookingSelection', () => {
  it('confirms selection and updates repositories', async () => {
    const orch = new BookingOrchestrator()
    const created = await createTripBookingSession({
      userId: '11111111-1111-4111-8111-111111111111',
      travelSessionId: null,
      flight: sampleFlight(),
      hotel: sampleHotel(),
      summary,
      orchestrator: orch,
      persist: true,
    })
    expect(created.session).not.toBeNull()

    const confirmed = await confirmTripBookingSelection(created.session!.id, orch)
    expect(confirmed.error).toBeNull()
    expect(confirmed.session?.confirmedAt).toBeTruthy()
  })
})

describe('bookingSessionFromRow', () => {
  it('maps supabase row into BookingSession', () => {
    const row: BookingSessionRow = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      travel_session_id: null,
      status: 'selected',
      items: [],
      subtotal: 100,
      fees: 0,
      total: 100,
      currency: 'SAR',
      selected_booking_mode: 'redirect',
      provider_references: [],
      created_at: '2026-07-14T00:00:00.000Z',
      updated_at: '2026-07-14T00:00:00.000Z',
      expires_at: '2026-07-15T00:00:00.000Z',
      redirected_at: null,
      confirmed_at: null,
    }
    const session = bookingSessionFromRow(row, [])
    expect(session.id).toBe(row.id)
    expect(session.total).toBe(100)
    expect(session.status).toBe('selected')
  })
})
