/**
 * TripRepository — mock persistence with versioned trip records.
 * Repository abstraction only; no Supabase / live store in Phase V.
 */

import type { ManagedTrip, TripQuery, TripVersionRecord } from './types'

function cloneTrip(trip: ManagedTrip): ManagedTrip {
  return structuredClone(trip)
}

function matchesQuery(trip: ManagedTrip, query: TripQuery): boolean {
  if (trip.userId !== query.userId) return false
  if (!query.includeArchived && (trip.archived || trip.status === 'archived')) return false
  if (query.favoritesOnly && !trip.favorite) return false

  if (query.status) {
    const statuses = Array.isArray(query.status) ? query.status : [query.status]
    if (!statuses.includes(trip.status)) return false
  }

  if (query.destination) {
    const needle = query.destination.trim().toLowerCase()
    const hay = [
      trip.summary.destination,
      ...trip.summary.destinations,
      ...(trip.itinerarySnapshot?.destinations ?? []),
    ].join(' ').toLowerCase()
    if (!hay.includes(needle)) return false
  }

  if (query.travelerId && !trip.travelerIds.includes(query.travelerId)) {
    return false
  }

  if (query.search) {
    const needle = query.search.trim().toLowerCase()
    const hay = [
      trip.title,
      trip.summary.destination,
      ...trip.summary.destinations,
      trip.id,
      ...trip.links.bookingSessionIds,
      ...trip.links.orderIds,
    ].join(' ').toLowerCase()
    if (!hay.includes(needle)) return false
  }

  return true
}

function sortTrips(
  trips: ManagedTrip[],
  sortBy: TripQuery['sortBy'] = 'startDate',
  sortDirection: TripQuery['sortDirection'] = 'desc',
): ManagedTrip[] {
  const dir = sortDirection === 'asc' ? 1 : -1
  return [...trips].sort((a, b) => {
    const av = sortValue(a, sortBy)
    const bv = sortValue(b, sortBy)
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return a.id.localeCompare(b.id) * dir
  })
}

function sortValue(trip: ManagedTrip, sortBy: TripQuery['sortBy']): string {
  switch (sortBy) {
    case 'createdAt':
      return trip.createdAt
    case 'updatedAt':
      return trip.updatedAt
    case 'destination':
      return trip.summary.destination.toLowerCase()
    case 'title':
      return trip.title.toLowerCase()
    case 'startDate':
    default:
      return trip.summary.startDate ?? trip.createdAt
  }
}

export class TripRepository {
  private readonly trips = new Map<string, ManagedTrip>()
  private readonly versions: TripVersionRecord[] = []

  create(trip: ManagedTrip): ManagedTrip {
    if (this.trips.has(trip.id)) {
      throw new Error(`Trip already exists: ${trip.id}`)
    }
    const stored = cloneTrip({ ...trip, version: trip.version || 1 })
    this.trips.set(stored.id, stored)
    this.recordVersion(stored)
    return cloneTrip(stored)
  }

  getById(tripId: string): ManagedTrip | null {
    const trip = this.trips.get(tripId)
    return trip ? cloneTrip(trip) : null
  }

  /**
   * Ownership-safe read — returns null when trip missing or not owned by userId.
   */
  getByIdForUser(tripId: string, userId: string): ManagedTrip | null {
    const trip = this.getById(tripId)
    if (!trip || trip.userId !== userId) return null
    return trip
  }

  update(trip: ManagedTrip): ManagedTrip {
    const existing = this.trips.get(trip.id)
    if (!existing) throw new Error(`Unknown trip: ${trip.id}`)
    if (existing.userId !== trip.userId) {
      throw new Error('Ownership mismatch on trip update')
    }
    const next = cloneTrip({
      ...trip,
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    })
    this.trips.set(next.id, next)
    this.recordVersion(next)
    return cloneTrip(next)
  }

  delete(tripId: string, userId: string): boolean {
    const existing = this.trips.get(tripId)
    if (!existing || existing.userId !== userId) return false
    this.trips.delete(tripId)
    return true
  }

  list(query: TripQuery): ManagedTrip[] {
    const filtered = [...this.trips.values()].filter((t) => matchesQuery(t, query))
    return sortTrips(filtered, query.sortBy, query.sortDirection).map(cloneTrip)
  }

  listVersions(tripId: string, userId: string): TripVersionRecord[] {
    const trip = this.trips.get(tripId)
    if (!trip || trip.userId !== userId) return []
    return this.versions
      .filter((v) => v.tripId === tripId)
      .map((v) => structuredClone(v))
  }

  clear(): void {
    this.trips.clear()
    this.versions.length = 0
  }

  private recordVersion(trip: ManagedTrip): void {
    this.versions.push({
      tripId: trip.id,
      version: trip.version,
      recordedAt: new Date().toISOString(),
      snapshot: cloneTrip(trip),
    })
  }
}

let defaultRepository: TripRepository | null = null

export function getTripRepository(): TripRepository {
  if (!defaultRepository) defaultRepository = new TripRepository()
  return defaultRepository
}

export function resetTripRepository(): void {
  defaultRepository?.clear()
  defaultRepository = null
}
