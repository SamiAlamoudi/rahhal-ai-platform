/**
 * Sprint 84 — detect itinerary / package conflicts.
 */

import type { PackageCandidate, PackageComponent } from '../packageBuilder/PackageCandidate'

export interface RefinementConflict {
  code: string
  message: string
  severity: 'hard' | 'soft'
  componentIds: string[]
}

function parseTime(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

function byKind(pkg: PackageCandidate, kind: string): PackageComponent[] {
  return pkg.components.filter((c) => c.kind === kind)
}

export function detectConflicts(
  pkg: PackageCandidate,
  options?: {
    budgetCap?: number | null
    maxWalkMinutes?: number | null
    meetings?: Array<{ at: string; title: string }>
  },
): RefinementConflict[] {
  const conflicts: RefinementConflict[] = []
  const flight = byKind(pkg, 'flight')[0]
  const hotel = byKind(pkg, 'hotel')[0]
  const transfer = byKind(pkg, 'transfer')[0]
  const activities = byKind(pkg, 'activity')

  const arrival = parseTime(flight?.payload.arrivalAt ?? pkg.arrivalAt)
  const departure = parseTime(flight?.payload.departureAt ?? pkg.departureAt)
  const checkIn = parseTime(hotel?.payload.checkIn ?? pkg.checkIn)
  const checkOut = parseTime(hotel?.payload.checkOut ?? pkg.checkOut)

  for (const act of activities) {
    const start = parseTime(act.payload.startAt)
    if (arrival != null && start != null && start < arrival) {
      conflicts.push({
        code: 'activity_before_arrival',
        message: 'Activity before arrival',
        severity: 'hard',
        componentIds: [act.id, flight?.id ?? 'flight'],
      })
    }
    if (checkOut != null && start != null && start > checkOut) {
      conflicts.push({
        code: 'activity_after_checkout',
        message: 'Activity after hotel stay',
        severity: 'hard',
        componentIds: [act.id, hotel?.id ?? 'hotel'],
      })
    }
    if (act.payload.closed === true) {
      conflicts.push({
        code: 'closed_attraction',
        message: 'Closed attraction',
        severity: 'hard',
        componentIds: [act.id],
      })
    }
  }

  // Duplicate activities
  const titles = new Map<string, string>()
  for (const act of activities) {
    const key = act.title.toLowerCase()
    if (titles.has(key)) {
      conflicts.push({
        code: 'duplicate_activity',
        message: 'Duplicate activities',
        severity: 'soft',
        componentIds: [titles.get(key)!, act.id],
      })
    } else {
      titles.set(key, act.id)
    }
  }

  if (transfer) {
    const from = parseTime(transfer.payload.availableFrom)
    const to = parseTime(transfer.payload.availableTo)
    if (arrival != null && from != null && to != null && (arrival < from || arrival > to)) {
      conflicts.push({
        code: 'impossible_transfer',
        message: 'Impossible transfer',
        severity: 'hard',
        componentIds: [transfer.id, flight?.id ?? 'flight'],
      })
    }
  }

  for (const meeting of options?.meetings ?? []) {
    const at = parseTime(meeting.at)
    if (at != null && checkIn != null && at < checkIn) {
      conflicts.push({
        code: 'hotel_after_meeting',
        message: 'Hotel after meeting',
        severity: 'hard',
        componentIds: [hotel?.id ?? 'hotel'],
      })
    }
  }

  // Flight overlaps (outbound after return proxy via duration nonsense)
  if (arrival != null && departure != null && arrival < departure) {
    // For single-leg package this can mean return stored as departureAt of outbound — skip
  }
  if (flight && typeof flight.payload.returnDepartureAt === 'string') {
    const ret = parseTime(flight.payload.returnDepartureAt)
    if (ret != null && arrival != null && ret < arrival) {
      conflicts.push({
        code: 'return_flight_conflict',
        message: 'Return flight conflict',
        severity: 'hard',
        componentIds: [flight.id],
      })
    }
    if (ret != null && checkOut != null && ret < checkOut - 2 * 3600_000) {
      // ok
    }
  }

  if (options?.budgetCap != null && pkg.totalPrice > options.budgetCap) {
    conflicts.push({
      code: 'budget_exceeded',
      message: 'Budget exceeded',
      severity: 'hard',
      componentIds: pkg.components.map((c) => c.id),
    })
  }

  const walk = typeof hotel?.payload.walkMinutes === 'number' ? hotel.payload.walkMinutes : null
  const maxWalk = options?.maxWalkMinutes ?? 35
  if (walk != null && walk > maxWalk) {
    conflicts.push({
      code: 'long_walking_distance',
      message: 'Long walking distance',
      severity: 'soft',
      componentIds: [hotel?.id ?? 'hotel'],
    })
  }

  // Overloaded day: >4 activities same calendar day
  const byDay = new Map<string, string[]>()
  for (const act of activities) {
    const start = typeof act.payload.startAt === 'string' ? act.payload.startAt.slice(0, 10) : 'unknown'
    const list = byDay.get(start) ?? []
    list.push(act.id)
    byDay.set(start, list)
  }
  for (const [, ids] of byDay) {
    if (ids.length >= 4) {
      conflicts.push({
        code: 'overloaded_day',
        message: 'Overloaded day',
        severity: 'soft',
        componentIds: ids,
      })
    }
  }

  // Flight overlap between two flight components
  const flights = byKind(pkg, 'flight')
  if (flights.length >= 2) {
    const a = parseTime(flights[0]!.payload.departureAt)
    const b = parseTime(flights[1]!.payload.departureAt)
    const aEnd = parseTime(flights[0]!.payload.arrivalAt)
    if (a != null && b != null && aEnd != null && b >= a && b <= aEnd) {
      conflicts.push({
        code: 'flight_overlaps',
        message: 'Flight overlaps',
        severity: 'hard',
        componentIds: [flights[0]!.id, flights[1]!.id],
      })
    }
  }

  return conflicts
}
