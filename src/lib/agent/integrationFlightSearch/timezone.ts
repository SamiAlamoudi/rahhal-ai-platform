/**
 * Integration Sprint 2 — lightweight calendar / timezone normalization.
 * Dates stay YYYY-MM-DD; optional IANA timezone is recorded for diagnostics.
 */

const DEFAULT_TZ = 'Asia/Riyadh'

export function normalizeTravelerTimezone(raw: string | null | undefined): string {
  const value = (raw ?? '').trim()
  if (!value) return DEFAULT_TZ
  try {
    // Throws RangeError for invalid IANA zones in modern runtimes.
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return value
  } catch {
    return DEFAULT_TZ
  }
}

/** Ensure ISO calendar date; invalid input falls back to +7 days UTC. */
export function normalizeCalendarDate(
  raw: string | null | undefined,
  fallbackDaysAhead = 7,
): string {
  const trimmed = (raw ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T12:00:00.000Z`)
    if (!Number.isNaN(d.getTime())) return trimmed
  }
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + fallbackDaysAhead)
  return d.toISOString().slice(0, 10)
}

export function departureHourUtc(iso: string | null | undefined): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.getUTCHours()
}

export function windowFromHour(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}
