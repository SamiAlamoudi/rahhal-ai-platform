/**
 * Maps booking domain sessions ↔ Supabase rows + local durable cache.
 * In-memory BookingOrchestrator remains the hot path; UI flows call persist*.
 */

import type { BookingSessionRow } from '../types'
import type { BookingItem, BookingSession, BookingStatus, BookingMode, ProviderReference } from './bookingTypes'
import { bookingSessionRepository } from '../repositories/bookingSessionRepository'
import { bookingEventRepository } from '../repositories/bookingEventRepository'
import { isDemoAuthEnabled } from '../auth/demoAuth'

const LOCAL_CACHE_KEY = 'rahhal_booking_sessions_v1'

export function sessionToCreateInput(session: BookingSession) {
  return {
    id: session.id,
    travel_session_id: session.travelSessionId,
    status: session.status,
    items: { list: session.items } as unknown as Record<string, unknown>,
    subtotal: session.subtotal,
    fees: session.fees,
    total: session.total,
    currency: session.currency,
    selected_booking_mode: session.selectedBookingMode,
    provider_references: { list: session.providerReferences } as unknown as Record<string, unknown>,
    expires_at: session.expiresAt,
    redirected_at: session.redirectedAt,
    confirmed_at: session.confirmedAt,
  }
}

export function sessionToUpdateInput(session: BookingSession) {
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

function parseItems(raw: unknown): BookingItem[] {
  if (Array.isArray(raw)) return raw as BookingItem[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { list?: unknown }).list)) {
    return (raw as { list: BookingItem[] }).list
  }
  return []
}

function parseProviderRefs(raw: unknown): ProviderReference[] {
  if (Array.isArray(raw)) return raw as ProviderReference[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { list?: unknown }).list)) {
    return (raw as { list: ProviderReference[] }).list
  }
  return []
}

export function sessionFromRow(row: BookingSessionRow): BookingSession {
  return {
    id: row.id,
    userId: row.user_id,
    travelSessionId: row.travel_session_id,
    status: row.status as BookingStatus,
    items: parseItems(row.items).map((item) => ({
      ...item,
      metadata: { ...(item.metadata ?? {}) },
    })),
    subtotal: Number(row.subtotal ?? 0),
    fees: Number(row.fees ?? 0),
    total: Number(row.total ?? 0),
    currency: row.currency || 'SAR',
    selectedBookingMode: (row.selected_booking_mode as BookingMode) || 'redirect',
    providerReferences: parseProviderRefs(row.provider_references),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    redirectedAt: row.redirected_at,
    confirmedAt: row.confirmed_at,
  }
}

function readLocalCache(): BookingSession[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as BookingSession[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalCache(sessions: BookingSession[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(sessions))
  } catch {
    // Quota / private mode — ignore; memory + Supabase remain primary.
  }
}

/** Upsert one session into the local durable cache (survives refresh / demo auth). */
export function upsertLocalBookingSession(session: BookingSession): void {
  const all = readLocalCache().filter((s) => s.id !== session.id)
  all.unshift(structuredClone(session))
  writeLocalCache(all.slice(0, 100))
}

export function listLocalBookingSessions(userId?: string | null): BookingSession[] {
  const all = readLocalCache()
  if (!userId) return all.map((s) => structuredClone(s))
  return all.filter((s) => s.userId === userId).map((s) => structuredClone(s))
}

export function getLocalBookingSession(sessionId: string): BookingSession | null {
  const found = readLocalCache().find((s) => s.id === sessionId)
  return found ? structuredClone(found) : null
}

export function clearLocalBookingSessions(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(LOCAL_CACHE_KEY)
}

/** Persist a newly created session (Supabase + local). Soft-fails network errors. */
export async function persistBookingSession(session: BookingSession): Promise<void> {
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
    // Demo / offline / missing Supabase — local cache still durable for this browser.
    if (!isDemoAuthEnabled()) {
      // Swallow: MVP must not break booking UI when DB is unavailable.
    }
  }
}

/** Sync an existing session after mutation. Soft-fails network errors. */
export async function syncBookingSession(
  session: BookingSession,
  fromStatus: string | null,
): Promise<void> {
  upsertLocalBookingSession(session)
  try {
    await bookingSessionRepository.update(session.id, sessionToUpdateInput(session))
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

export async function loadBookingSession(sessionId: string): Promise<BookingSession | null> {
  try {
    const row = await bookingSessionRepository.getById(sessionId)
    if (row) {
      const session = sessionFromRow(row)
      upsertLocalBookingSession(session)
      return session
    }
  } catch {
    // fall through to local
  }
  return getLocalBookingSession(sessionId)
}

/** Prefer Supabase list; merge/fallback to local cache for the user. */
export async function listUserBookingSessions(
  userId: string,
  limit = 50,
): Promise<BookingSession[]> {
  const local = listLocalBookingSessions(userId)
  try {
    const rows = await bookingSessionRepository.listByUser(limit)
    const fromDb = rows.map(sessionFromRow)
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
