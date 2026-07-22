/**
 * Sprint 114 — ConflictResolver
 * Detects and auto-resolves impossible / overlapping schedule issues.
 */

import type { ItineraryConflict, ItineraryDayPlan, ItineraryTimeBlock } from './types'

function overlaps(a: ItineraryTimeBlock, b: ItineraryTimeBlock): boolean {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes
}

export function detectConflicts(days: ItineraryDayPlan[]): ItineraryConflict[] {
  const conflicts: ItineraryConflict[] = []
  for (const day of days) {
    const blocks = day.blocks
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i]!
        const b = blocks[j]!
        if (overlaps(a, b)) {
          conflicts.push({
            kind: 'overlapping_activities',
            dayDate: day.date,
            message: `Overlap: "${a.title}" and "${b.title}" on ${day.date}`,
            resolved: false,
            resolution: null,
          })
        }
      }
    }

    if (day.isArrivalDay) {
      const arrival = blocks.find((b) => b.kind === 'flight_arrival')
      const checkIn = blocks.find((b) => b.kind === 'hotel_check_in')
      if (arrival && checkIn && checkIn.startMinutes < arrival.endMinutes) {
        conflicts.push({
          kind: 'missed_check_in',
          dayDate: day.date,
          message: 'Hotel check-in starts before flight arrival completes',
          resolved: false,
          resolution: null,
        })
      }
      if (arrival && arrival.startMinutes >= 22 * 60) {
        conflicts.push({
          kind: 'late_arrival',
          dayDate: day.date,
          message: 'Late arrival leaves limited evening schedule capacity',
          resolved: false,
          resolution: null,
        })
      }
    }

    if (day.isDepartureDay) {
      const checkout = blocks.find((b) => b.kind === 'hotel_check_out')
      const departure = blocks.find((b) => b.kind === 'flight_departure')
      if (checkout && departure && checkout.endMinutes > departure.startMinutes) {
        conflicts.push({
          kind: 'early_departure',
          dayDate: day.date,
          message: 'Check-out ends after flight departure',
          resolved: false,
          resolution: null,
        })
      }
      if (departure && departure.startMinutes < 6 * 60) {
        conflicts.push({
          kind: 'impossible_schedule',
          dayDate: day.date,
          message: 'Departure before 06:00 creates an impossible morning buffer',
          resolved: false,
          resolution: null,
        })
      }
    }
  }
  return conflicts
}

export function resolveConflicts(days: ItineraryDayPlan[]): {
  days: ItineraryDayPlan[]
  conflicts: ItineraryConflict[]
} {
  const resolved: ItineraryConflict[] = []
  const nextDays = days.map((day) => {
    let blocks = [...day.blocks].sort(
      (a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id),
    )

    // Resolve overlaps by shifting the later soft block
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i]!
        const b = blocks[j]!
        if (!overlaps(a, b)) continue
        const softKinds = new Set([
          'activity',
          'sightseeing',
          'meal',
          'free_time',
          'walking',
          'business_meeting',
          'rest',
        ])
        const shiftTarget = softKinds.has(b.kind) ? j : softKinds.has(a.kind) ? i : j
        const other = shiftTarget === j ? a : b
        const target = blocks[shiftTarget]!
        const duration = target.durationMinutes
        const newStart = other.endMinutes + 5
        const newEnd = newStart + duration
        if (newEnd <= 24 * 60) {
          blocks[shiftTarget] = {
            ...target,
            startMinutes: newStart,
            endMinutes: newEnd,
            notes: [...target.notes, 'Shifted to resolve overlap'],
          }
          resolved.push({
            kind: 'overlapping_activities',
            dayDate: day.date,
            message: `Overlap resolved by shifting "${target.title}"`,
            resolved: true,
            resolution: `Moved to start at minute ${newStart}`,
          })
          blocks = [...blocks].sort(
            (x, y) => x.startMinutes - y.startMinutes || x.id.localeCompare(y.id),
          )
        } else {
          // Drop free_time / walking if cannot shift
          if (target.kind === 'free_time' || target.kind === 'walking') {
            blocks = blocks.filter((b) => b.id !== target.id)
            resolved.push({
              kind: 'overlapping_activities',
              dayDate: day.date,
              message: `Removed "${target.title}" to resolve overlap`,
              resolved: true,
              resolution: 'Dropped low-priority block',
            })
          }
        }
      }
    }

    // Fix check-in before arrival
    const arrival = blocks.find((b) => b.kind === 'flight_arrival')
    const checkInIdx = blocks.findIndex((b) => b.kind === 'hotel_check_in')
    if (arrival && checkInIdx >= 0) {
      const checkIn = blocks[checkInIdx]!
      if (checkIn.startMinutes < arrival.endMinutes) {
        const start = arrival.endMinutes + 15
        blocks[checkInIdx] = {
          ...checkIn,
          startMinutes: start,
          endMinutes: start + checkIn.durationMinutes,
          notes: [...checkIn.notes, 'Deferred until after arrival'],
        }
        resolved.push({
          kind: 'missed_check_in',
          dayDate: day.date,
          message: 'Check-in deferred until after arrival + transfer buffer',
          resolved: true,
          resolution: `Check-in starts at minute ${start}`,
        })
      }
    }

    // Fix checkout after departure
    const departure = blocks.find((b) => b.kind === 'flight_departure')
    const checkoutIdx = blocks.findIndex((b) => b.kind === 'hotel_check_out')
    if (departure && checkoutIdx >= 0) {
      const checkout = blocks[checkoutIdx]!
      if (checkout.endMinutes > departure.startMinutes) {
        const end = Math.max(6 * 60, departure.startMinutes - 120)
        const start = Math.max(5 * 60, end - checkout.durationMinutes)
        blocks[checkoutIdx] = {
          ...checkout,
          startMinutes: start,
          endMinutes: end,
          notes: [...checkout.notes, 'Moved earlier for departure'],
        }
        resolved.push({
          kind: 'early_departure',
          dayDate: day.date,
          message: 'Check-out moved earlier to protect departure',
          resolved: true,
          resolution: `Check-out ends at minute ${end}`,
        })
      }
    }

    // Late arrival: strip evening sightseeing / acknowledge limited capacity
    if (arrival && arrival.startMinutes >= 22 * 60) {
      const before = blocks.length
      blocks = blocks.filter(
        (b) =>
          !(
            (b.kind === 'sightseeing' || b.kind === 'activity')
            && b.dayPart === 'evening'
          ),
      )
      resolved.push({
        kind: 'late_arrival',
        dayDate: day.date,
        message:
          blocks.length !== before
            ? 'Evening activities removed due to late arrival'
            : 'Late arrival acknowledged; evening capacity limited',
        resolved: true,
        resolution:
          blocks.length !== before
            ? 'Kept transfer, check-in, and rest only'
            : 'No evening sightseeing remained to remove',
      })
    }

    blocks = blocks.sort(
      (a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id),
    )

    const morning = blocks.filter((b) => b.dayPart === 'morning')
    const afternoon = blocks.filter((b) => b.dayPart === 'afternoon')
    const evening = blocks.filter((b) => b.dayPart === 'evening')
    const night = blocks.filter((b) => b.dayPart === 'night')

    return {
      ...day,
      blocks,
      morning,
      afternoon,
      evening,
      night,
      freeMinutes: blocks
        .filter((b) => b.kind === 'free_time' || b.kind === 'rest')
        .reduce((s, b) => s + b.durationMinutes, 0),
      walkingMinutes: blocks
        .filter((b) => b.kind === 'walking')
        .reduce((s, b) => s + b.durationMinutes, 0),
      transferMinutes: blocks
        .filter((b) => b.kind === 'transfer')
        .reduce((s, b) => s + b.durationMinutes, 0),
    }
  })

  // Merge unresolved detections that weren't fixed
  const still = detectConflicts(nextDays).filter((c) => !c.resolved)
  const all = [
    ...resolved,
    ...still.map((c) => ({ ...c, resolved: false })),
  ]
  return { days: nextDays, conflicts: all }
}

export class ConflictResolver {
  detect(days: ItineraryDayPlan[]): ItineraryConflict[] {
    return detectConflicts(days)
  }

  resolve(days: ItineraryDayPlan[]) {
    return resolveConflicts(days)
  }
}

export function createConflictResolver(): ConflictResolver {
  return new ConflictResolver()
}
