/**
 * Derive trip duration and airport-leave recommendations from flight times.
 */

export function parseIso(value: string | null | undefined): Date | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? new Date(t) : null
}

export function flightDurationMinutes(
  departureTime: string | null | undefined,
  arrivalTime: string | null | undefined,
): number | null {
  const dep = parseIso(departureTime)
  const arr = parseIso(arrivalTime)
  if (!dep || !arr) return null
  const mins = Math.round((arr.getTime() - dep.getTime()) / 60_000)
  return mins > 0 ? mins : null
}

export function formatDuration(minutes: number | null, locale: 'ar' | 'en'): string {
  if (minutes == null) return locale === 'ar' ? '—' : '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (locale === 'ar') {
    if (h <= 0) return `${m} دقيقة`
    if (m === 0) return `${h} ساعة`
    return `${h} ساعة و ${m} دقيقة`
  }
  if (h <= 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Recommend leaving for airport N hours before departure (domestic vs intl heuristic). */
export function airportArriveBeforeMinutes(stops: number | null): number {
  // International / multi-stop → earlier; simple domestic → 2h
  if (stops != null && stops > 0) return 180
  return 150
}

export function recommendLeaveForAirport(
  departureTime: string | null | undefined,
  stops: number | null,
): Date | null {
  const dep = parseIso(departureTime)
  if (!dep) return null
  const buffer = airportArriveBeforeMinutes(stops)
  return new Date(dep.getTime() - buffer * 60_000)
}

export function tripDurationDays(
  departureTime: string | null | undefined,
  arrivalTime: string | null | undefined,
  fallback = 3,
): number {
  const dep = parseIso(departureTime)
  const arr = parseIso(arrivalTime)
  if (!dep) return fallback
  // Outbound-only booking: estimate stay from calendar day span when return unknown.
  // Prefer at least 2 days for planner; use arrival day + 1 night heuristic when same-day.
  if (!arr) return fallback
  const start = Date.UTC(dep.getUTCFullYear(), dep.getUTCMonth(), dep.getUTCDate())
  const end = Date.UTC(arr.getUTCFullYear(), arr.getUTCMonth(), arr.getUTCDate())
  const nights = Math.max(1, Math.round((end - start) / 86_400_000))
  // For one-way outbound, planner uses destination stay estimate:
  // arrival day + following full days (default short trip).
  if (nights <= 1) return fallback
  return Math.min(14, nights + 1)
}

export function addDays(isoDate: Date, days: number): Date {
  const d = new Date(isoDate.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}
