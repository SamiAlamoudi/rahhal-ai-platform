/**
 * Maps booking domain sessions ↔ Supabase rows + per-user local durable cache.
 * In-memory BookingOrchestrator remains the hot path; UI flows call persist*.
 */

import type { BookingSessionRow } from '../types'
import type {
  BookingItem,
  BookingSession,
  BookingStatus,
  BookingMode,
  ProviderReference,
} from './bookingTypes'
import { bookingSessionRepository } from '../repositories/bookingSessionRepository'
import { bookingEventRepository } from '../repositories/bookingEventRepository'

const LOCAL_CACHE_PREFIX = 'rahhal_booking_sessions_v1:'

function localCacheKey(userId: string): string {
  return `${LOCAL_CACHE_PREFIX}${userId}`
}

function sessionPayload(session: BookingSession) {
  return {
    status: session.status,
    items: { list: session.items } as unknown as Record<string, unknown>,
    subtotal: session.subtotal,
    fees: session.fees,
    total: session.total,
    currency: session.currency,
    selected_booking_mode: session.selectedBookingMode,
    provider_references: { list: session.providerReferences } as unknown as Record<string, unknown>,
    redirected_at: session.redirectedAt,
    confirmed_at: session.confirmedAt,
  }
}

export function sessionToCreateInput(session: BookingSession) {
  return {
    id: session.id,
    travel_session_id: session.travelSessionId,
    expires_at: session.expiresAt,
    ...sessionPayload(session),
  }
}

export function sessionToUpdateInput(session: BookingSession) {
  return sessionPayload(session)
}

function parseListField<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { list?: unknown }).list)) {
    return (raw as { list: T[] }).list
  }
  return []
}

export function sessionFromRow(row: BookingSessionRow): BookingSession {
  return {
    id: row.id,
    userId: row.user_id,
    travelSessionId: row.travel_session_id,
    status: row.status as BookingStatus,
    items: parseListField<BookingItem>(row.items).map((item) => ({
      ...item,
      metadata: { ...(item.metadata ?? {}) },
    })),
    subtotal: Number(row.subtotal ?? 0),
    fees: Number(row.fees ?? 0),
    total: Number(row.total ?? 0),
    currency: row.currency || 'SAR',
    selectedBookingMode: (row.selected_booking_mode as BookingMode) || 'redirect',
    providerReferences: parseListField<ProviderReference>(row.provider_references),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    redirectedAt: row.redirected_at,
    confirmedAt: row.confirmed_at,
  }
}

function readLocalCache(userId: string): BookingSession[] {
  if (typeof localStorage === 'undefined' || !userId) return []
  try {
    const raw = localStorage.getItem(localCacheKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as BookingSession[]
    if (!Array.isArray(parsed)) return []
    // Defend against tampered cache entries from another identity.
    return parsed.filter((s) => s && s.userId === userId)
  } catch {
    return []
  }
}

function writeLocalCache(userId: string, sessions: BookingSession[]): void {
  if (typeof localStorage === 'undefined' || !userId) return
  try {
    localStorage.setItem(localCacheKey(userId), JSON.stringify(sessions))
  } catch {
    // Quota / private mode — ignore; memory + Supabase remain primary.
  }
}

/** Upsert one session into the per-user local durable cache. */
export function upsertLocalBookingSession(session: BookingSession): void {
  if (!session.userId || session.userId === 'anonymous') return
  const all = readLocalCache(session.userId).filter((s) => s.id !== session.id)
  all.unshift(structuredClone(session))
  writeLocalCache(session.userId, all.slice(0, 100))
}

export function listLocalBookingSessions(userId: string): BookingSession[] {
  if (!userId) return []
  return readLocalCache(userId).map((s) => structuredClone(s))
}

export function getLocalBookingSession(
  sessionId: string,
  userId: string,
): BookingSession | null {
  if (!userId) return null
  const found = readLocalCache(userId).find((s) => s.id === sessionId)
  return found ? structuredClone(found) : null
}

export function clearLocalBookingSessions(userId?: string): void {
  if (typeof localStorage === 'undefined') return
  if (userId) {
    localStorage.removeItem(localCacheKey(userId))
    return
  }
  // Test helper: wipe all booking caches for this origin.
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key?.startsWith(LOCAL_CACHE_PREFIX)) keys.push(key)
  }
  for (const key of keys) localStorage.removeItem(key)
}

function assertOwned(session: BookingSession, userId: string | null | undefined): BookingSession | null {
  if (!userId || session.userId !== userId) return null
  return session
}

/** Persist a newly created session (Supabase + local). Soft-fails network errors. */
export async function persistBookingSession(session: BookingSession): Promise<void> {
  if (!session.userId || session.userId === 'anonymous') return
  upsertLocalBookingSession(session)
  try {
    await bookingSessionRepository.create(sessionToCreateInput(session))
    await bookingEventRepository.create({
      booking_session_id: session.id,
      event_type: 'session_created',
      from_status: null,
      to_status: session.status,
      details: { itemCount: session.items.length },
    })
  } catch {
    // Offline / missing Supabase — local per-user cache remains durable for this browser.
  }
}

/**
 * Sync an existing session after mutation.
 * Upserts: update first; if the row is missing, create (covers offline-first create).
 */
export async function syncBookingSession(
  session: BookingSession,
  fromStatus: string | null,
): Promise<void> {
  if (!session.userId || session.userId === 'anonymous') return
  upsertLocalBookingSession(session)
  try {
    const updated = await bookingSessionRepository.update(
      session.id,
      sessionToUpdateInput(session),
    )
    if (!updated) {
      await bookingSessionRepository.create(sessionToCreateInput(session))
    }
    if (fromStatus !== session.status) {
      await bookingEventRepository.create({
        booking_session_id: session.id,
        event_type: 'status_changed',
        from_status: fromStatus,
        to_status: session.status,
        details: { itemCount: session.items.length },
      })
    }
  } catch {
    // Local cache already updated.
  }
}

export async function loadBookingSession(
  sessionId: string,
  userId: string,
): Promise<BookingSession | null> {
  if (!userId) return null
  try {
    const row = await bookingSessionRepository.getById(sessionId)
    if (row) {
      const session = assertOwned(sessionFromRow(row), userId)
      if (session) {
        upsertLocalBookingSession(session)
        return session
      }
      return null
    }
  } catch {
    // fall through to local
  }
  return getLocalBookingSession(sessionId, userId)
}

/** Prefer Supabase list; merge/fallback to per-user local cache. */
export async function listUserBookingSessions(
  userId: string,
  limit = 50,
): Promise<BookingSession[]> {
  if (!userId) return []
  const local = listLocalBookingSessions(userId)
  try {
    const rows = await bookingSessionRepository.listByUser(limit)
    const fromDb = rows
      .map(sessionFromRow)
      .filter((s) => s.userId === userId)
    const byId = new Map<string, BookingSession>()
    for (const s of fromDb) byId.set(s.id, s)
    for (const s of local) {
      if (!byId.has(s.id)) byId.set(s.id, s)
    }
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  } catch {
    return local
  }
}
