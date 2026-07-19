/**
 * Sprint 12 — Passenger Management & Booking Flow.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  ageOnDate,
  buildFareBreakdown,
  buildPassengerConciergeSummary,
  clearPassengerDraft,
  createPassengerSlots,
  emptyPassenger,
  expectedTypeForAge,
  isValidCountryCode,
  loadPassengerDraft,
  persistPassengersToSession,
  readPassengersFromSession,
  savePassengerDraft,
  validatePassenger,
  validatePassengerParty,
  type Passenger,
} from '../passengers'
import {
  clearLocalBookingSessions,
  getBookingOrchestrator,
  persistBookingSession,
  resetBookingOrchestrator,
} from '../booking'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'

function adult(overrides: Partial<Passenger> = {}): Passenger {
  return {
    ...emptyPassenger('adult', 'adult-1'),
    title: 'mr',
    firstName: 'Ahmed',
    lastName: 'Alami',
    gender: 'male',
    dateOfBirth: '1990-05-10',
    nationality: 'SA',
    passportNumber: 'A1234567',
    passportExpiry: '2030-01-01',
    passportIssuingCountry: 'SA',
    email: 'ahmed@example.com',
    mobileNumber: '+966501234567',
    ...overrides,
  }
}

function child(overrides: Partial<Passenger> = {}): Passenger {
  return {
    ...emptyPassenger('child', 'child-1'),
    title: 'mstr',
    firstName: 'Omar',
    lastName: 'Alami',
    gender: 'male',
    dateOfBirth: '2018-03-01',
    nationality: 'SA',
    passportNumber: 'C9876543',
    passportExpiry: '2029-06-01',
    passportIssuingCountry: 'SA',
    ...overrides,
  }
}

async function seedFlightSession(counts = { adults: 2, children: 1, infants: 0, total: 3 }) {
  const orch = getBookingOrchestrator()
  const session = orch.createBookingSession({
    userId: 'user-s12',
    travelSessionId: 'ts-s12',
    currency: 'SAR',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  })
  const added = orch.addBookingItem(session.id, {
    type: 'flight',
    providerId: 'provider-1',
    providerName: 'Provider',
    providerOfferId: 'offer-1',
    title: 'RUH → DXB',
    price: 2000,
    currency: 'SAR',
    bookingUrl: 'https://example.com/book',
    expiresAt: null,
    travelerSummary: `adults:${counts.adults}|children:${counts.children}|infants:${counts.infants}|total:${counts.total}`,
    metadata: {
      sprint: 11,
      selectedItinerary: {
        origin: 'RUH',
        destination: 'DXB',
        departureTime: '2026-11-10T08:00:00',
        arrivalTime: '2026-11-10T11:00:00',
        cabin: 'economy',
        airline: 'Saudia',
        stops: 0,
      },
      pricing: { amount: 2000, currency: 'SAR' },
      travellersPlaceholder: counts,
      bookingPayload: { kind: 'flight_selection', offerId: 'offer-1' },
    },
  })
  if (!added.session) throw new Error(added.error || 'seed failed')
  await persistBookingSession(added.session)
  return added.session
}

describe('Sprint 12 age rules', () => {
  it('classifies adult/child/infant relative to departure', () => {
    expect(ageOnDate('1990-01-01', '2026-11-10')).toBe(36)
    expect(expectedTypeForAge(36)).toBe('adult')
    expect(expectedTypeForAge(8)).toBe('child')
    expect(expectedTypeForAge(1)).toBe('infant')
  })
})

describe('Sprint 12 passport & field validation', () => {
  const departureDate = '2026-11-10'

  it('accepts a complete adult passenger', () => {
    const result = validatePassenger(adult(), { departureDate, locale: 'en' })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects expired passport and invalid email/phone/country', () => {
    const result = validatePassenger(
      adult({
        passportExpiry: '2020-01-01',
        email: 'not-an-email',
        mobileNumber: '12',
        nationality: 'Saudi',
      }),
      { departureDate, locale: 'en' },
    )
    expect(result.valid).toBe(false)
    expect(result.fieldMessages.passportExpiry).toMatch(/valid on the departure/i)
    expect(result.fieldMessages.email).toMatch(/invalid/i)
    expect(result.fieldMessages.mobileNumber).toMatch(/invalid/i)
    expect(result.fieldMessages.nationality).toMatch(/country code/i)
  })

  it('rejects child age for adult slot', () => {
    const result = validatePassenger(
      adult({ dateOfBirth: '2018-01-01' }),
      { departureDate, locale: 'en' },
    )
    expect(result.valid).toBe(false)
    expect(result.fieldMessages.dateOfBirth).toMatch(/Expected: child/i)
  })

  it('validates ISO country codes', () => {
    expect(isValidCountryCode('sa')).toBe(true)
    expect(isValidCountryCode('XX')).toBe(true)
    expect(isValidCountryCode('S')).toBe(false)
    expect(isValidCountryCode('SAU')).toBe(false)
  })
})

describe('Sprint 12 passenger counts & empty states', () => {
  it('creates slots matching adults/children/infants', () => {
    const slots = createPassengerSlots({ adults: 2, children: 1, infants: 1, total: 4 })
    expect(slots).toHaveLength(4)
    expect(slots.filter((p) => p.type === 'adult')).toHaveLength(2)
    expect(slots.filter((p) => p.type === 'child')).toHaveLength(1)
    expect(slots.filter((p) => p.type === 'infant')).toHaveLength(1)
  })

  it('defaults empty counts to one adult slot', () => {
    expect(createPassengerSlots({ adults: 0, children: 0, infants: 0, total: 0 })).toHaveLength(1)
  })

  it('rejects party when counts mismatch itinerary', () => {
    const expected = { adults: 2, children: 1, infants: 0, total: 3 }
    const result = validatePassengerParty([adult()], expected, {
      departureDate: '2026-11-10',
      locale: 'en',
    })
    expect(result.valid).toBe(false)
    expect(result.fieldMessages.counts).toMatch(/must match the itinerary/i)
  })

  it('accepts multiple passengers matching itinerary', () => {
    const expected = { adults: 2, children: 1, infants: 0, total: 3 }
    const party = [
      adult({ id: 'a1' }),
      adult({
        id: 'a2',
        firstName: 'Sara',
        lastName: 'Alami',
        title: 'mrs',
        gender: 'female',
        email: 'sara@example.com',
        mobileNumber: '+966509998877',
      }),
      child({ id: 'c1' }),
    ]
    const result = validatePassengerParty(party, expected, {
      departureDate: '2026-11-10',
      locale: 'en',
    })
    expect(result.valid).toBe(true)
  })
})

describe('Sprint 12 fare breakdown', () => {
  it('computes fare, taxes, fees, grand total', () => {
    const breakdown = buildFareBreakdown(1000, 'SAR', { taxRate: 0.15, fees: 0 })
    expect(breakdown.fare).toBe(1000)
    expect(breakdown.taxes).toBe(150)
    expect(breakdown.fees).toBe(0)
    expect(breakdown.grandTotal).toBe(1150)
    expect(breakdown.currency).toBe('SAR')
  })
})

describe('Sprint 12 AI concierge summary', () => {
  it('builds non-hardcoded consultant summary with party + passport hint', () => {
    const summary = buildPassengerConciergeSummary({
      counts: { adults: 2, children: 1, infants: 0, total: 3 },
      locale: 'en',
      remindPassportExpiry: true,
    })
    expect(summary.partyLine).toMatch(/two adults|2 adults/i)
    expect(summary.partyLine).toMatch(/1 child/i)
    expect(summary.passportHint).toMatch(/passport expiry/i)
    expect(summary.summaryText.length).toBeGreaterThan(20)
    expect(summary.summaryText).toMatch(/travelling|passport|adult/i)
  })

  it('handles empty passenger list with party counts only', () => {
    const summary = buildPassengerConciergeSummary({
      counts: { adults: 1, children: 0, infants: 0, total: 1 },
      passengers: [],
      locale: 'en',
    })
    expect(summary.partyLine).toMatch(/1 adult/i)
  })
})

describe('Sprint 12 booking session persistence', () => {
  beforeEach(() => {
    resetBookingOrchestrator()
    clearLocalBookingSessions()
  })

  it('persists passengers, pricing, booking payload, session id', async () => {
    const session = await seedFlightSession()
    const expected = { adults: 2, children: 1, infants: 0, total: 3 }
    const party = [
      adult({ id: 'a1' }),
      adult({
        id: 'a2',
        firstName: 'Sara',
        email: 'sara@example.com',
        mobileNumber: '+966501111111',
        title: 'mrs',
        gender: 'female',
      }),
      child({ id: 'c1' }),
    ]

    const result = await persistPassengersToSession({
      sessionId: session.id,
      passengers: party,
      counts: expected,
      passengersComplete: true,
    })

    expect(result.session.id).toBe(session.id)
    const item = result.session.items[0]
    expect(item.metadata.passengers).toHaveLength(3)
    expect(item.metadata.passengersComplete).toBe(true)
    expect(item.metadata.sessionId).toBe(session.id)
    expect(item.metadata.pricing).toMatchObject({
      fare: 2000,
      taxes: 300,
      grandTotal: 2300,
      currency: 'SAR',
    })
    expect(item.metadata.bookingPayload).toMatchObject({
      sessionId: session.id,
    })
    expect(item.travelerSummary).toContain('adults:2')
    expect(readPassengersFromSession(result.session)?.[0].firstName).toBe('Ahmed')
  })

  it('saves and loads draft for resume after refresh', () => {
    const draft = [adult({ firstName: 'Draft' })]
    savePassengerDraft('sess-1', draft)
    expect(loadPassengerDraft('sess-1')?.[0].firstName).toBe('Draft')
    clearPassengerDraft('sess-1')
    expect(loadPassengerDraft('sess-1')).toBeNull()
  })
})

describe('Sprint 12 feature flag', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  it('registers ui.passenger_booking_flow with flight results dependency', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('ui.passenger_booking_flow')).toBe(true)
    registry.setEnabled('ui.flight_results_experience', false)
    expect(registry.isEnabled('ui.passenger_booking_flow')).toBe(false)
  })
})

describe('Sprint 12 provider-agnostic surface', () => {
  it('passengers public API does not expose supplier clients', async () => {
    const mod = await import('../passengers')
    const keys = Object.keys(mod).join(' ').toLowerCase()
    expect(keys).not.toMatch(/amadeus|duffel|travelport|sabre/)
    expect(typeof mod.validatePassenger).toBe('function')
    expect(typeof mod.persistPassengersToSession).toBe('function')
  })
})
