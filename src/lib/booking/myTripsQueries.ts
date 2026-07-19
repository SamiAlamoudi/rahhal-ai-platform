/**
 * Sprint 13 — My Trips queries over booking sessions (no duplicate store).
 */

import type { BookingSession } from './bookingTypes'
import { getBookingOrchestrator } from './bookingOrchestrator'
import {
  getLocalBookingSession,
  listUserBookingSessions,
  loadBookingSession,
  syncBookingSession,
  upsertLocalBookingSession,
} from './bookingPersistence'
import {
  attachBookingRecordMetadata,
  toBookingRecord,
  type BookingRecord,
  type TripBucket,
} from './bookingRecord'

export interface MyTripsLists {
  upcoming: BookingRecord[]
  completed: BookingRecord[]
  cancelled: BookingRecord[]
  all: BookingRecord[]
}

export async function loadUserBookingRecords(userId: string): Promise<BookingRecord[]> {
  const loaded = await listUserBookingSessions(userId)
  const orch = getBookingOrchestrator()
  orch.replaceUserSessions(userId, loaded)

  const records: BookingRecord[] = []
  for (const session of orch.getSessionsByUser(userId)) {
    const attached = attachBookingRecordMetadata(session)
    // Persist reference snapshot when missing (durable for resume)
    const hadRef = typeof session.items[0]?.metadata?.bookingReference === 'string'
    orch.importSession(attached)
    if (!hadRef) {
      await syncBookingSession(attached, session.status)
      upsertLocalBookingSession(attached)
    }
    records.push(toBookingRecord(attached))
  }

  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function partitionBookingRecords(records: BookingRecord[]): MyTripsLists {
  const upcoming: BookingRecord[] = []
  const completed: BookingRecord[] = []
  const cancelled: BookingRecord[] = []
  for (const record of records) {
    if (record.bucket === 'upcoming') upcoming.push(record)
    else if (record.bucket === 'completed') completed.push(record)
    else cancelled.push(record)
  }
  return { upcoming, completed, cancelled, all: records }
}

export async function loadMyTrips(userId: string): Promise<MyTripsLists> {
  const records = await loadUserBookingRecords(userId)
  return partitionBookingRecords(records)
}

export function filterRecordsByBucket(
  records: BookingRecord[],
  bucket: TripBucket | 'all',
): BookingRecord[] {
  if (bucket === 'all') return records
  return records.filter((r) => r.bucket === bucket)
}

export function findLatestBookingRecord(records: BookingRecord[]): BookingRecord | null {
  if (records.length === 0) return null
  return [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
}

export function findBookingRecordById(
  records: BookingRecord[],
  sessionId: string,
): BookingRecord | null {
  return records.find((r) => r.sessionId === sessionId) ?? null
}

export function sessionsToRecords(sessions: BookingSession[]): BookingRecord[] {
  return sessions.map((s) => toBookingRecord(attachBookingRecordMetadata(s)))
}

/** Resolve a booking session for details / resume (memory → Supabase → local). */
export async function resolveBookingSessionForUser(
  sessionId: string,
  userId: string,
): Promise<BookingSession | null> {
  const orchestrator = getBookingOrchestrator()
  const cached = orchestrator.getBookingSession(sessionId)
  if (cached?.userId === userId) return cached

  const loaded = await loadBookingSession(sessionId, userId)
  if (loaded) {
    orchestrator.importSession(loaded)
    return loaded
  }

  const local = getLocalBookingSession(sessionId, userId)
  if (local) {
    orchestrator.importSession(local)
    return local
  }
  return null
}
