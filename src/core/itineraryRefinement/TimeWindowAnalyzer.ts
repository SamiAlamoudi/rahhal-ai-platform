/**
 * Sprint 84 — analyze arrival / stay / activity time windows.
 */

import type { PackageCandidate } from '../packageBuilder/PackageCandidate'

export interface TimeWindowAnalysis {
  arrivalAt: number | null
  checkInAt: number | null
  checkOutAt: number | null
  departureAt: number | null
  freeWindows: Array<{ start: number; end: number }>
  restNeededAfterArrivalMinutes: number
  mealSlots: Array<{ start: number; label: string }>
}

function parseTime(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

export function analyzeTimeWindows(pkg: PackageCandidate): TimeWindowAnalysis {
  const flight = pkg.components.find((c) => c.kind === 'flight')
  const hotel = pkg.components.find((c) => c.kind === 'hotel')
  const arrivalAt = parseTime(flight?.payload.arrivalAt ?? pkg.arrivalAt)
  const departureAt = parseTime(flight?.payload.returnDepartureAt ?? flight?.payload.departureAt)
  const checkInAt = parseTime(hotel?.payload.checkIn ?? pkg.checkIn)
  const checkOutAt = parseTime(hotel?.payload.checkOut ?? pkg.checkOut)

  const restNeededAfterArrivalMinutes = 90
  const freeWindows: Array<{ start: number; end: number }> = []
  if (arrivalAt != null && checkOutAt != null) {
    freeWindows.push({
      start: arrivalAt + restNeededAfterArrivalMinutes * 60_000,
      end: checkOutAt,
    })
  }

  const mealSlots: Array<{ start: number; label: string }> = []
  if (arrivalAt != null) {
    const dayStart = arrivalAt
    mealSlots.push(
      { start: dayStart + 2 * 3600_000, label: 'lunch' },
      { start: dayStart + 7 * 3600_000, label: 'dinner' },
    )
  }

  return {
    arrivalAt,
    checkInAt,
    checkOutAt,
    departureAt,
    freeWindows,
    restNeededAfterArrivalMinutes,
    mealSlots,
  }
}

export function isEarlyFlight(pkg: PackageCandidate, hourThreshold = 8): boolean {
  const flight = pkg.components.find((c) => c.kind === 'flight')
  const dep = flight?.payload.departureAt
  if (typeof dep !== 'string') {
    const hour = typeof flight?.payload.departureHour === 'number' ? flight.payload.departureHour : null
    return hour != null && hour < hourThreshold
  }
  const d = new Date(dep)
  if (Number.isNaN(d.getTime())) return false
  return d.getUTCHours() < hourThreshold
}
