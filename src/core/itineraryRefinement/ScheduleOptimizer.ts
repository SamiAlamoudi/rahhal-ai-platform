/**
 * Sprint 84 — optimize arrival → hotel → activities → meals → rest.
 */

import type { PackageCandidate, PackageComponent } from '../packageBuilder/PackageCandidate'
import { analyzeTimeWindows } from './TimeWindowAnalyzer'

function parseTime(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

export function optimizeSchedule(pkg: PackageCandidate): {
  pkg: PackageCandidate
  touchedIds: string[]
} {
  const windows = analyzeTimeWindows(pkg)
  const touched: string[] = []
  let cursor = windows.arrivalAt != null
    ? windows.arrivalAt + windows.restNeededAfterArrivalMinutes * 60_000
    : null

  const components = pkg.components.map((c) => {
    if (c.kind === 'hotel' && windows.arrivalAt != null) {
      const checkIn = parseTime(c.payload.checkIn)
      if (checkIn != null && windows.arrivalAt > checkIn) {
        // Late check-in note — keep id, adjust payload only
        touched.push(c.id)
        return {
          ...c,
          payload: { ...c.payload, lateCheckIn: true, optimized: true },
        }
      }
    }
    if (c.kind === 'activity' && cursor != null && !c.payload.meeting) {
      const duration = 2 * 3600_000
      const start = new Date(cursor).toISOString()
      cursor += duration + 45 * 60_000 // buffer / meal gap
      touched.push(c.id)
      return {
        ...c,
        payload: {
          ...c.payload,
          startAt: start,
          endAt: new Date(Date.parse(start) + duration).toISOString(),
          scheduleOptimized: true,
        },
      }
    }
    if (c.kind === 'transfer') {
      touched.push(c.id)
      return {
        ...c,
        payload: {
          ...c.payload,
          alignedToArrival: true,
          availableFrom: pkg.arrivalAt,
          scheduleOptimized: true,
        },
      }
    }
    return c
  })

  // Ensure meeting timing preserved before leisure
  const meetings = components.filter((c) => c.payload.meeting === true)
  const rest = components.filter((c) => c.payload.meeting !== true)
  const ordered: PackageComponent[] = []
  for (const c of rest) {
    if (c.kind === 'flight' || c.kind === 'hotel' || c.kind === 'transfer') ordered.push(c)
  }
  ordered.push(...meetings)
  for (const c of rest) {
    if (c.kind === 'activity') ordered.push(c)
  }
  for (const c of rest) {
    if (!['flight', 'hotel', 'transfer', 'activity'].includes(c.kind)) ordered.push(c)
  }

  return {
    pkg: { ...pkg, components: ordered.length ? ordered : components },
    touchedIds: [...new Set(touched)],
  }
}
