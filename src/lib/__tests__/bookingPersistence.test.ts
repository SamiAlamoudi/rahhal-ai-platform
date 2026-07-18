import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  BookingOrchestrator,
  clearLocalBookingSessions,
  getLocalBookingSession,
  listLocalBookingSessions,
  listUserBookingSessions,
  loadBookingSession,
  persistBookingSession,
  sessionFromRow,
  sessionToCreateInput,
  syncBookingSession,
  upsertLocalBookingSession,
} from '../booking'
import type { BookingSessionRow } from '../types'
import { bookingSessionRepository } from '../repositories/bookingSessionRepository'
import { bookingEventRepository } from '../repositories/bookingEventRepository'

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

function sampleSession(overrides: Partial<ReturnType<BookingOrchestrator['createBookingSession']>> = {}) {
  const orch = new BookingOrchestrator()
  const session = orch.createBookingSession({
    userId: 'user-mvp-1',
    travelSessionId: null,
    currency: 'SAR',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  })
  orch.addBookingItem(session.id, {
    type: 'flight',
    providerId: 'amadeus-flight-001',
    providerName: 'Amadeus',
    providerOfferId: 'offer-1',
    title: 'RUH → DXB',
    price: 1200,
    currency: 'SAR',
    bookingUrl: 'https://www.amadeus.com/book/1',
    expiresAt: null,
    travelerSummary: '1 adult',
    metadata: { cabin: 'economy' },
  })
  const full = orch.getBookingSession(session.id)!
  return { ...full, ...overrides }
}

describe('booking persistence mapping', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
    clearLocalBookingSessions()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips domain session through row mapping', () => {
    const session = sampleSession()
    const input = sessionToCreateInput(session)
    expect(input.id).toBe(session.id)
    expect((input.items as { list: unknown[] }).list).toHaveLength(1)

    const row: BookingSessionRow = {
      id: session.id,
      user_id: session.userId,
      travel_session_id: session.travelSessionId,
      status: session.status,
      items: input.items,
      subtotal: session.subtotal,
      fees: session.fees,
      total: session.total,
      currency: session.currency,
      selected_booking_mode: session.selectedBookingMode,
      provider_references: input.provider_references,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      expires_at: session.expiresAt,
      redirected_at: null,
      confirmed_at: null,
    }
    const hydrated = sessionFromRow(row)
    expect(hydrated.id).toBe(session.id)
    expect(hydrated.items[0]?.title).toBe('RUH → DXB')
    expect(hydrated.total).toBe(1200)
  })

  it('keeps local durable cache across orchestrator reset', async () => {
    const session = sampleSession()
    vi.spyOn(bookingSessionRepository, 'create').mockRejectedValue(new Error('offline'))
    vi.spyOn(bookingSessionRepository, 'listByUser').mockRejectedValue(new Error('offline'))
    vi.spyOn(bookingEventRepository, 'create').mockRejectedValue(new Error('offline'))

    await persistBookingSession(session)
    expect(listLocalBookingSessions('user-mvp-1')).toHaveLength(1)

    const orch = new BookingOrchestrator()
    expect(orch.getAllSessions()).toHaveLength(0)
    const loaded = await listUserBookingSessions('user-mvp-1')
    orch.replaceUserSessions('user-mvp-1', loaded)
    expect(orch.getSessionsByUser('user-mvp-1')[0]?.items[0]?.title).toBe('RUH → DXB')
  })

  it('isolates local cache by user and rejects cross-user loads', async () => {
    const sessionA = sampleSession({ userId: 'user-a' })
    const sessionB = sampleSession({ userId: 'user-b' })
    upsertLocalBookingSession(sessionA)
    upsertLocalBookingSession(sessionB)

    expect(listLocalBookingSessions('user-a')).toHaveLength(1)
    expect(listLocalBookingSessions('user-b')).toHaveLength(1)
    expect(getLocalBookingSession(sessionA.id, 'user-b')).toBeNull()

    vi.spyOn(bookingSessionRepository, 'getById').mockResolvedValue({
      id: sessionA.id,
      user_id: 'user-a',
      travel_session_id: null,
      status: sessionA.status,
      items: { list: sessionA.items },
      subtotal: sessionA.subtotal,
      fees: sessionA.fees,
      total: sessionA.total,
      currency: sessionA.currency,
      selected_booking_mode: sessionA.selectedBookingMode,
      provider_references: { list: sessionA.providerReferences },
      created_at: sessionA.createdAt,
      updated_at: sessionA.updatedAt,
      expires_at: sessionA.expiresAt,
      redirected_at: null,
      confirmed_at: null,
    })

    await expect(loadBookingSession(sessionA.id, 'user-b')).resolves.toBeNull()
    await expect(loadBookingSession(sessionA.id, 'user-a')).resolves.toMatchObject({
      id: sessionA.id,
      userId: 'user-a',
    })
  })

  it('skips anonymous sessions and creates on missing update row', async () => {
    await persistBookingSession(sampleSession({ userId: 'anonymous' }))
    expect(listLocalBookingSessions('anonymous')).toHaveLength(0)

    const session = sampleSession()
    const createSpy = vi.spyOn(bookingSessionRepository, 'create').mockResolvedValue(null)
    vi.spyOn(bookingSessionRepository, 'update').mockResolvedValue(null)
    vi.spyOn(bookingEventRepository, 'create').mockResolvedValue(null)

    await syncBookingSession({ ...session, status: 'redirected' }, 'selected')
    expect(createSpy).toHaveBeenCalled()
  })

  it('syncs status changes to local cache and attempts repository update', async () => {
    const session = sampleSession()
    upsertLocalBookingSession(session)
    const updateSpy = vi.spyOn(bookingSessionRepository, 'update').mockResolvedValue({
      id: session.id,
      user_id: session.userId,
      travel_session_id: session.travelSessionId,
      status: 'redirected',
      items: { list: session.items },
      subtotal: session.subtotal,
      fees: session.fees,
      total: session.total,
      currency: session.currency,
      selected_booking_mode: session.selectedBookingMode,
      provider_references: { list: session.providerReferences },
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      expires_at: session.expiresAt,
      redirected_at: new Date().toISOString(),
      confirmed_at: null,
    })
    const eventSpy = vi.spyOn(bookingEventRepository, 'create').mockResolvedValue(null)

    const redirected = { ...session, status: 'redirected' as const, redirectedAt: new Date().toISOString() }
    await syncBookingSession(redirected, 'selected')

    expect(updateSpy).toHaveBeenCalled()
    expect(eventSpy).toHaveBeenCalled()
    expect(listLocalBookingSessions('user-mvp-1')[0]?.status).toBe('redirected')
  })

  it('imports persisted sessions into orchestrator hot cache', () => {
    const session = sampleSession()
    const orch = new BookingOrchestrator()
    orch.importSession(session)
    expect(orch.getBookingSession(session.id)?.total).toBe(1200)
    orch.replaceUserSessions('user-mvp-1', [session])
    expect(orch.getSessionsByUser('user-mvp-1')).toHaveLength(1)
  })
})
