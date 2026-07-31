/**
 * Sprint 13 — My Trips & Booking Records.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  attachBookingRecordMetadata,
  buildBookingHistoryConciergeReply,
  classifyTripBucket,
  clearLocalBookingSessions,
  findLatestBookingRecord,
  getBookingOrchestrator,
  partitionBookingRecords,
  persistBookingSession,
  resetBookingOrchestrator,
  temporaryBookingReference,
  toBookingRecord,
  type BookingRecord,
} from '../booking'
import { createTravelAgentService } from '../agent/travelAgentService'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { toBookingHistoryEntry } from '../trips/bookingHistory'
import type { ChatMessage } from '../chat/chatTypes'

function installMemoryLocalStorage(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    get length() {
      return store.size
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  })
}

async function seedSession(input: {
  userId: string
  status?: 'draft' | 'confirmed' | 'cancelled'
  departureTime?: string
  confirmedAt?: string | null
}) {
  const orch = getBookingOrchestrator()
  const session = orch.createBookingSession({
    userId: input.userId,
    travelSessionId: null,
    currency: 'SAR',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  })
  orch.addBookingItem(session.id, {
    type: 'flight',
    providerId: 'p1',
    providerName: 'Provider',
    providerOfferId: 'off-1',
    title: 'RUH → DXB',
    price: 1000,
    currency: 'SAR',
    bookingUrl: 'https://example.com/book',
    expiresAt: null,
    travelerSummary: 'adults:1|children:0|infants:0|total:1',
    metadata: {
      sprint: 12,
      selectedItinerary: {
        origin: 'RUH',
        destination: 'DXB',
        departureTime: input.departureTime ?? '2026-12-01T08:00:00',
        arrivalTime: '2026-12-01T11:00:00',
        airline: 'Saudia',
        cabin: 'economy',
        stops: 0,
      },
      pricing: { amount: 1000, currency: 'SAR', fare: 1000, taxes: 150, fees: 0, grandTotal: 1150 },
      travellersPlaceholder: { adults: 1, children: 0, infants: 0, total: 1 },
      passengers: [
        {
          id: 'p1',
          type: 'adult',
          title: 'mr',
          firstName: 'Ahmed',
          lastName: 'Alami',
          gender: 'male',
          dateOfBirth: '1990-01-01',
          nationality: 'SA',
          passportNumber: 'A1234567',
          passportExpiry: '2030-01-01',
          passportIssuingCountry: 'SA',
          email: 'a@example.com',
          mobileNumber: '+966501234567',
          emergencyContact: '',
          specialAssistance: '',
          mealPreference: '',
          frequentFlyerNumber: '',
        },
      ],
      passengersComplete: true,
      bookingPayload: { kind: 'flight_selection' },
    },
  })
  let live = orch.getBookingSession(session.id)!
  if (input.status === 'confirmed') {
    live = {
      ...live,
      status: 'confirmed',
      confirmedAt: input.confirmedAt ?? new Date().toISOString(),
    }
    orch.importSession(live)
  }
  if (input.status === 'cancelled') {
    orch.cancelBookingSession(session.id)
    live = orch.getBookingSession(session.id)!
  }
  const attached = attachBookingRecordMetadata(live)
  orch.importSession(attached)
  await persistBookingSession(attached)
  return attached
}

describe('Sprint 13 booking records', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
    clearLocalBookingSessions()
    resetBookingOrchestrator()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('generates temporary booking references', () => {
    expect(temporaryBookingReference('abc-def-12345678')).toMatch(/^RHL-[A-Z0-9]+$/)
  })

  it('persists booking reference + record snapshot on session metadata', async () => {
    const session = await seedSession({ userId: 'u1' })
    const record = toBookingRecord(session)
    expect(record.bookingReference).toMatch(/^RHL-/)
    expect(session.items[0].metadata.bookingReference).toBe(record.bookingReference)
    expect(session.items[0].metadata.bookingRecord).toMatchObject({
      bookingReference: record.bookingReference,
    })
    expect(record.passengers).toHaveLength(1)
    expect(record.fare.grandTotal).toBe(1150)
    expect(record.timeline.length).toBeGreaterThan(0)
  })

  it('classifies upcoming / completed / cancelled buckets', async () => {
    const upcoming = await seedSession({
      userId: 'u1',
      departureTime: '2099-01-01T08:00:00',
    })
    expect(classifyTripBucket(upcoming)).toBe('upcoming')

    const completed = await seedSession({
      userId: 'u1',
      status: 'confirmed',
      departureTime: '2020-01-01T08:00:00',
    })
    expect(classifyTripBucket(completed)).toBe('completed')

    const cancelled = await seedSession({ userId: 'u1', status: 'cancelled' })
    expect(classifyTripBucket(cancelled)).toBe('cancelled')
  })

  it('partitions My Trips lists', async () => {
    await seedSession({ userId: 'u1', departureTime: '2099-06-01T08:00:00' })
    await seedSession({
      userId: 'u1',
      status: 'confirmed',
      departureTime: '2020-06-01T08:00:00',
    })
    await seedSession({ userId: 'u1', status: 'cancelled' })
    const records = getBookingOrchestrator()
      .getSessionsByUser('u1')
      .map((s) => toBookingRecord(s))
    const lists = partitionBookingRecords(records)
    expect(lists.upcoming.length).toBeGreaterThanOrEqual(1)
    expect(lists.completed.length).toBeGreaterThanOrEqual(1)
    expect(lists.cancelled.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Sprint 13 concierge booking history', () => {
  const sample: BookingRecord = {
    sessionId: 'sess-1',
    userId: 'u1',
    bookingReference: 'RHL-TEST1234',
    status: 'selected',
    bucket: 'upcoming',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
    confirmedAt: null,
    redirectedAt: null,
    expiresAt: '2026-08-01T00:00:00.000Z',
    flight: {
      title: 'RUH → DXB',
      airline: 'Saudia',
      origin: 'RUH',
      destination: 'DXB',
      departureTime: '2026-12-01T08:00:00',
      arrivalTime: '2026-12-01T11:00:00',
      cabin: 'economy',
      stops: 0,
    },
    passengers: [],
    fare: {
      fare: 1000,
      taxes: 150,
      fees: 0,
      grandTotal: 1150,
      currency: 'SAR',
      taxRate: 0.15,
    },
    itemTitles: ['RUH → DXB'],
    currency: 'SAR',
    total: 1000,
    providerBookingReference: null,
    passengersComplete: true,
    timeline: [],
  }

  it('builds show trips / latest / details / summarize replies', () => {
    const trips = buildBookingHistoryConciergeReply({
      intent: 'show_trips',
      records: [sample],
      locale: 'en',
    })
    expect(trips).toMatch(/1 booking|upcoming/i)

    const latest = buildBookingHistoryConciergeReply({
      intent: 'show_latest_booking',
      records: [sample],
      locale: 'en',
    })
    expect(latest).toMatch(/RHL-TEST1234/)

    const details = buildBookingHistoryConciergeReply({
      intent: 'show_booking_details',
      records: [sample],
      locale: 'en',
      focusSessionId: 'sess-1',
    })
    expect(details).toMatch(/Saudia|RUH/)

    const summary = buildBookingHistoryConciergeReply({
      intent: 'summarize_itinerary',
      records: [sample],
      locale: 'en',
    })
    expect(summary).toMatch(/itinerary|Saudia/i)
  })

  it('handles empty booking history', () => {
    const reply = buildBookingHistoryConciergeReply({
      intent: 'show_trips',
      records: [],
      locale: 'en',
    })
    expect(reply).toMatch(/do not have any bookings/i)
  })

  it('planTurn answers show my trips via injected records', async () => {
    resetFeatureRegistry()
    const service = createTravelAgentService({
      concierge: false,
      listBookingRecords: async () => [sample],
    })
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        conversationId: 'c1',
        role: 'user',
        modality: 'text',
        content: 'Show my trips',
        audioUrl: null,
        imageUrl: null,
        attachments: [],
        status: 'complete',
        error: null,
        providerMeta: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    const turn = await service.planTurn({ conversationId: 'c1', messages })
    expect(turn.memory.lastIntent).toBe('show_trips')
    expect(turn.reply.length).toBeGreaterThan(10)
    expect(turn.meta.spokenText?.length).toBeGreaterThan(0)
    expect(sample.bookingReference).toBe('RHL-TEST1234')
  })
})

describe('Sprint 13 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  it('registers myTrips / bookingHistory aliases as ui.my_trips / ui.booking_history', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('ui.my_trips')).toBe(true)
    expect(registry.isEnabled('ui.booking_history')).toBe(true)
    registry.setEnabled('ui.my_trips', false)
    expect(registry.isEnabled('ui.booking_history')).toBe(false)
  })
})

describe('Sprint 13 booking history projection', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
    clearLocalBookingSessions()
    resetBookingOrchestrator()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('extends BookingHistoryEntry with reference + bucket', async () => {
    const session = await seedSession({ userId: 'u2' })
    const entry = toBookingHistoryEntry(session)
    expect(entry.bookingReference).toMatch(/^RHL-/)
    expect(entry.bucket).toBe('upcoming')
  })

  it('finds latest booking record', () => {
    const older = sampleRecord('old', '2026-01-01T00:00:00.000Z')
    const newer = sampleRecord('new', '2026-07-01T00:00:00.000Z')
    expect(findLatestBookingRecord([older, newer])?.sessionId).toBe('new')
  })
})

function sampleRecord(id: string, updatedAt: string): BookingRecord {
  return {
    sessionId: id,
    userId: 'u',
    bookingReference: `RHL-${id.toUpperCase()}`,
    status: 'draft',
    bucket: 'upcoming',
    createdAt: updatedAt,
    updatedAt,
    confirmedAt: null,
    redirectedAt: null,
    expiresAt: updatedAt,
    flight: null,
    passengers: [],
    fare: { fare: 0, taxes: 0, fees: 0, grandTotal: 0, currency: 'SAR', taxRate: 0.15 },
    itemTitles: [],
    currency: 'SAR',
    total: 0,
    providerBookingReference: null,
    passengersComplete: false,
    timeline: [],
  }
}
