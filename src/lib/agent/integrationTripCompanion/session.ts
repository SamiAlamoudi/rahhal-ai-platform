/**
 * Integration Sprint 7 — TripSession lifecycle states.
 */

import type { TripPlan } from '../types'
import type { TripSession, TripSessionState } from './types'

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function resolveTripSessionState(input: {
  plan: TripPlan | null
  now?: Date
  forcedState?: TripSessionState | null
  disruption?: string | null
  meetingMode?: boolean
}): TripSessionState {
  if (input.forcedState) return input.forcedState
  const now = input.now ?? new Date()
  const plan = input.plan
  if (!plan) return 'upcoming'

  const start = parseDate(plan.startDate)
  const end = parseDate(plan.endDate)

  // Explicit traveler/disruption signals outrank calendar completion so live
  // companion cues ("in transit", "checked in") stay meaningful on trip-end day.
  const disruption = (input.disruption ?? '').toLowerCase()
  if (/return|عودة|راجع/.test(disruption)) return 'returning'
  if (input.meetingMode || /meeting|اجتماع/.test(disruption)) return 'meeting_mode'
  if (/in transit|في الطريق|boarding|صعود/.test(disruption)) return 'in_transit'
  if (/checked.?in|تسجيل وصول/.test(disruption)) return 'checked_in'
  if (/explor|جولة|أتجول/.test(disruption)) return 'exploring'

  if (end && now.getTime() > end.getTime() + 12 * 60 * 60 * 1000) return 'completed'

  if (start) {
    const startDay = new Date(start)
    startDay.setUTCHours(0, 0, 0, 0)
    const endOfStart = new Date(startDay)
    endOfStart.setUTCHours(23, 59, 59, 999)
    if (now >= startDay && now <= endOfStart) return 'travel_day'
    if (now < startDay) return 'upcoming'
  }

  if (end && now >= (start ?? now) && now <= end) return 'exploring'
  return 'upcoming'
}

export function createTripSession(input: {
  plan: TripPlan | null
  now?: Date
  forcedState?: TripSessionState | null
  disruption?: string | null
  meetingMode?: boolean
}): TripSession {
  const now = input.now ?? new Date()
  const state = resolveTripSessionState(input)
  return {
    id: `trip-session-${input.plan?.id ?? 'draft'}`,
    state,
    tripId: input.plan?.id ?? null,
    destination: input.plan?.destinations[0]
      ?? input.plan?.requirements.destination
      ?? null,
    startDate: input.plan?.startDate ?? null,
    endDate: input.plan?.endDate ?? null,
    updatedAt: now.toISOString(),
  }
}

export const TRIP_SESSION_STATES: TripSessionState[] = [
  'upcoming',
  'travel_day',
  'in_transit',
  'checked_in',
  'exploring',
  'meeting_mode',
  'returning',
  'completed',
]
