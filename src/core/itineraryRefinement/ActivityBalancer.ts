/**
 * Sprint 84 — spread activities across stay days; avoid overload.
 */

import type { PackageCandidate, PackageComponent } from '../packageBuilder/PackageCandidate'

function dayKey(iso: string | null | undefined, fallback: string): string {
  if (!iso) return fallback
  return iso.slice(0, 10)
}

export function balanceActivities(pkg: PackageCandidate): {
  pkg: PackageCandidate
  touchedIds: string[]
} {
  const hotel = pkg.components.find((c) => c.kind === 'hotel')
  const checkIn = typeof hotel?.payload.checkIn === 'string'
    ? hotel.payload.checkIn
    : pkg.checkIn
  const checkOut = typeof hotel?.payload.checkOut === 'string'
    ? hotel.payload.checkOut
    : pkg.checkOut

  const start = checkIn ? new Date(checkIn) : null
  const end = checkOut ? new Date(checkOut) : null
  const days: string[] = []
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    const cursor = new Date(start)
    while (cursor < end && days.length < 14) {
      days.push(cursor.toISOString().slice(0, 10))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }
  if (days.length === 0) days.push(dayKey(checkIn, 'day1'))

  const touched: string[] = []
  let i = 0
  const components = pkg.components.map((c) => {
    if (c.kind !== 'activity' || c.payload.meeting === true) return c
    const day = days[i % days.length]!
    i += 1
    touched.push(c.id)
    const hour = 10 + ((i * 2) % 8)
    return {
      ...c,
      payload: {
        ...c.payload,
        startAt: `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`,
        endAt: `${day}T${String(hour + 2).padStart(2, '0')}:00:00.000Z`,
        balanced: true,
      },
    } satisfies PackageComponent
  })

  return { pkg: { ...pkg, components }, touchedIds: touched }
}
