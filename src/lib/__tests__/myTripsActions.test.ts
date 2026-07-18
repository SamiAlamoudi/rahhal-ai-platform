import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  BookingOrchestrator,
  canCancelBookingSession,
  canResumeBookingSession,
  clearLocalBookingSessions,
  isTerminalBookingStatus,
  listUserBookingSessions,
  persistBookingSession,
  syncBookingSession,
} from '../booking'
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

describe('My Trips lifecycle actions', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
    clearLocalBookingSessions()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('classifies resume / cancel / terminal statuses', () => {
    expect(canResumeBookingSession('draft')).toBe(true)
    expect(canResumeBookingSession('redirected')).toBe(true)
    expect(canResumeBookingSession('confirmed')).toBe(false)

    expect(canCancelBookingSession('selected')).toBe(true)
    expect(canCancelBookingSession('cancelled')).toBe(false)
    expect(isTerminalBookingStatus('expired')).toBe(true)
  })

  it('cancels a persisted booking session and lists it as cancelled', async () => {
    vi.spyOn(bookingSessionRepository, 'create').mockRejectedValue(new Error('offline'))
    vi.spyOn(bookingSessionRepository, 'update').mockRejectedValue(new Error('offline'))
    vi.spyOn(bookingSessionRepository, 'listByUser').mockRejectedValue(new Error('offline'))
    vi.spyOn(bookingEventRepository, 'create').mockRejectedValue(new Error('offline'))

    const orch = new BookingOrchestrator()
    const session = orch.createBookingSession({
      userId: 'user-trips-1',
      travelSessionId: null,
      currency: 'SAR',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    })
    orch.addBookingItem(session.id, {
      type: 'hotel',
      providerId: 'booking-com',
      providerName: 'Booking.com',
      providerOfferId: 'hotel-1',
      title: 'Hilton DXB',
      price: 800,
      currency: 'SAR',
      bookingUrl: 'https://www.booking.com/hotel/1',
      expiresAt: null,
      travelerSummary: '1 adult',
      metadata: {},
    })
    const full = orch.getBookingSession(session.id)!
    await persistBookingSession(full)

    const fromStatus = full.status
    const cancelled = orch.cancelBookingSession(full.id)!
    expect(cancelled.status).toBe('cancelled')
    await syncBookingSession(cancelled, fromStatus)

    const listed = await listUserBookingSessions('user-trips-1')
    expect(listed).toHaveLength(1)
    expect(listed[0]?.status).toBe('cancelled')
    expect(canCancelBookingSession(listed[0]!.status)).toBe(false)
    expect(canResumeBookingSession(listed[0]!.status)).toBe(false)
  })
})
