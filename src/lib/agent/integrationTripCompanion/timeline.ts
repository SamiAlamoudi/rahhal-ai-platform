/**
 * Integration Sprint 7 — Travel Timeline Engine.
 */

import type { ItineraryDay, TripPlan } from '../types'
import type {
  CompanionTimelineEvent,
  TimelineEventKind,
  TimelineEventStatus,
  TravelTimelineSnapshot,
  TripSessionState,
} from './types'

function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000)
}

function atLocalMinutes(dayIso: string | null, dayOffset: number, hh: number, mm: number): string {
  const base = dayIso ? new Date(`${dayIso}T00:00:00.000Z`) : new Date()
  base.setUTCDate(base.getUTCDate() + Math.max(0, dayOffset))
  base.setUTCHours(hh, mm, 0, 0)
  return base.toISOString()
}

function parseActivityTime(time: string | null): { hh: number; mm: number } | null {
  if (!time) return null
  const m = time.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return { hh: Math.min(23, hh), mm: Math.min(59, mm) }
}

function kindFromTitle(title: string): TimelineEventKind {
  const t = title.toLowerCase()
  if (/flight|طيران|airport|مطار/.test(t)) return 'flight'
  if (/check.?in|تسجيل/.test(t)) return 'hotel_check_in'
  if (/check.?out|مغادرة الفندق/.test(t)) return 'hotel_check_out'
  if (/meeting|اجتماع/.test(t)) return 'meeting'
  if (/restaurant|dinner|lunch|عشاء|غداء|مطعم/.test(t)) return 'restaurant'
  if (/transfer|taxi|مترو|تاكسي/.test(t)) return 'transfer'
  return 'activity'
}

export function seedEventsFromPlan(plan: TripPlan, _now?: Date): CompanionTimelineEvent[] {
  const days: ItineraryDay[] = plan.dailyItinerary.length
    ? plan.dailyItinerary
    : plan.activities
  const events: CompanionTimelineEvent[] = []

  if (plan.flights[0]) {
    const f = plan.flights[0]
    events.push({
      id: 'flight-outbound',
      kind: 'flight',
      titleEn: `Flight ${f.from} → ${f.to}`,
      titleAr: `رحلة ${f.from} → ${f.to}`,
      startAt: atLocalMinutes(plan.startDate, 0, 9, 0),
      endAt: atLocalMinutes(plan.startDate, 0, 13, 0),
      locationLabel: f.from,
      status: 'upcoming',
      remainingMinutes: null,
      notesEn: f.notes ?? undefined,
    })
  }

  if (plan.accommodations[0]) {
    const h = plan.accommodations[0]
    events.push({
      id: 'hotel-check-in',
      kind: 'hotel_check_in',
      titleEn: `Check-in · ${h.name}`,
      titleAr: `تسجيل وصول · ${h.name}`,
      startAt: atLocalMinutes(plan.startDate, 0, 15, 0),
      endAt: null,
      locationLabel: h.area || h.name,
      status: 'upcoming',
      remainingMinutes: null,
    })
  }

  for (const day of days.slice(0, 5)) {
    const dayIndex = Math.max(0, (day.day || 1) - 1)
    day.activities.forEach((act, idx) => {
      const parsed = parseActivityTime(act.time) ?? { hh: 10 + idx * 2, mm: 0 }
      const startAt = atLocalMinutes(plan.startDate, dayIndex, parsed.hh, parsed.mm)
      const end = new Date(startAt)
      end.setUTCMinutes(end.getUTCMinutes() + 90)
      events.push({
        id: `day${day.day}-act${idx}`,
        kind: kindFromTitle(act.title),
        titleEn: act.title,
        titleAr: act.title,
        startAt,
        endAt: end.toISOString(),
        locationLabel: day.location || null,
        status: 'upcoming',
        remainingMinutes: null,
        notesEn: act.description ?? undefined,
        notesAr: act.description ?? undefined,
      })
    })
  }

  if (plan.endDate) {
    events.push({
      id: 'return-flight',
      kind: 'flight',
      titleEn: 'Return flight',
      titleAr: 'رحلة العودة',
      startAt: atLocalMinutes(plan.endDate, 0, 11, 0),
      endAt: atLocalMinutes(plan.endDate, 0, 15, 0),
      locationLabel: plan.destinations[0] ?? null,
      status: 'upcoming',
      remainingMinutes: null,
    })
  }

  // Deterministic order
  return events.sort((a, b) => a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id))
}

function annotateStatuses(
  events: CompanionTimelineEvent[],
  now: Date,
  skippedIds: Set<string>,
): CompanionTimelineEvent[] {
  return events.map((ev) => {
    if (skippedIds.has(ev.id) || ev.status === 'skipped') {
      return { ...ev, status: 'skipped' as TimelineEventStatus, remainingMinutes: null }
    }
    if (ev.status === 'rescheduled') {
      // Keep rescheduled label but still compute remaining relative to new start.
      const start = new Date(ev.startAt)
      const remaining = minutesBetween(now, start)
      const end = ev.endAt ? new Date(ev.endAt) : new Date(start.getTime() + 60 * 60000)
      let status: TimelineEventStatus = 'rescheduled'
      if (now >= end) status = 'missed'
      else if (now >= start && now < end) status = 'current'
      else if (remaining < 0) status = 'late'
      return {
        ...ev,
        status,
        remainingMinutes: status === 'rescheduled' || status === 'late'
          ? Math.max(remaining, 0)
          : null,
      }
    }

    const start = new Date(ev.startAt)
    const end = ev.endAt ? new Date(ev.endAt) : new Date(start.getTime() + 60 * 60000)
    const remaining = minutesBetween(now, start)
    let status: TimelineEventStatus = 'upcoming'
    if (now >= end) {
      status = now.getTime() - end.getTime() > 45 * 60000 ? 'missed' : 'done'
    } else if (now >= start && now < end) {
      // Started more than 10 minutes ago without completion → late-in-progress
      status = now.getTime() - start.getTime() > 10 * 60000 ? 'late' : 'current'
    } else if (remaining < 0) {
      status = 'late'
    } else {
      status = 'upcoming'
    }

    return {
      ...ev,
      status,
      remainingMinutes:
        status === 'upcoming' || status === 'late'
          ? Math.max(remaining, 0)
          : null,
    }
  })
}

export function buildTravelTimeline(input: {
  plan: TripPlan | null
  now?: Date
  sessionState?: TripSessionState
  skippedEventIds?: string[]
  events?: CompanionTimelineEvent[] | null
}): TravelTimelineSnapshot {
  const now = input.now ?? new Date()
  const skipped = new Set(input.skippedEventIds ?? [])
  const base = input.events?.length
    ? input.events
    : input.plan
      ? seedEventsFromPlan(input.plan, now)
      : []
  const annotated = annotateStatuses(base, now, skipped)
  const current = annotated.find((e) => e.status === 'current') ?? null
  const next = annotated.find((e) =>
    e.status === 'upcoming' || e.status === 'late' || e.status === 'rescheduled') ?? null
  const upcoming = annotated.filter((e) =>
    e.status === 'upcoming' || e.status === 'late' || e.status === 'rescheduled')
  const late = annotated.filter((e) => e.status === 'late')
  const missed = annotated.filter((e) => e.status === 'missed' || e.status === 'skipped')
  const remainingTodayMinutes = upcoming
    .slice(0, 6)
    .reduce((sum, e) => sum + (e.remainingMinutes ?? 0), 0)

  return {
    current,
    next,
    upcoming,
    late,
    missed,
    remainingTodayMinutes,
  }
}
