/**
 * Sprint 114 — Intelligent Itinerary Engine contracts.
 * Transforms Trip Builder output into day-by-day schedules (additive).
 */

import type { RahhalFlightSearchOffer } from '../liveFlightSearch/types'
import type { HotelOffer } from '../liveHotelSearch/types'
import type { TripCandidate } from '../tripBuilder/types'

export const SPRINT114_ITINERARY_ENGINE_VERSION = '1.0.0-itinerary-engine'

export type TripStyleKind = 'leisure' | 'family' | 'business' | 'mixed'

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night'

export type ItineraryBlockKind =
  | 'flight_arrival'
  | 'flight_departure'
  | 'hotel_check_in'
  | 'hotel_check_out'
  | 'transfer'
  | 'walking'
  | 'activity'
  | 'sightseeing'
  | 'meal'
  | 'free_time'
  | 'business_meeting'
  | 'rest'

export type ItineraryConflictKind =
  | 'overlapping_activities'
  | 'late_arrival'
  | 'missed_check_in'
  | 'early_departure'
  | 'impossible_schedule'

export interface ItineraryCityStay {
  city: string
  country?: string | null
  arriveDate: string
  departDate: string
  hotel?: HotelOffer | null
  notes?: string[]
}

export interface ItineraryEngineInput {
  conversationId?: string | null
  /** Preferred: selected Trip Builder candidate. */
  trip?: TripCandidate | null
  /** Explicit multi-city stays (optional; defaults from trip). */
  cities?: ItineraryCityStay[] | null
  flights?: RahhalFlightSearchOffer[] | null
  hotels?: HotelOffer[] | null
  destination?: string | null
  departureDate?: string | null
  returnDate?: string | null
  checkInDate?: string | null
  checkOutDate?: string | null
  style?: TripStyleKind | null
  adults?: number | null
  children?: number | null
  /** Optional activity interests (free-form). */
  interests?: string[] | null
  /** Simulated delay minutes on inbound arrival (tests / resilience). */
  arrivalDelayMinutes?: number | null
}

export interface ItineraryTimeBlock {
  id: string
  kind: ItineraryBlockKind
  dayPart: DayPart
  title: string
  startMinutes: number
  endMinutes: number
  durationMinutes: number
  location: string | null
  notes: string[]
  why: string
}

export interface ItineraryDayPlan {
  date: string
  dayIndex: number
  city: string
  label: string
  isArrivalDay: boolean
  isDepartureDay: boolean
  blocks: ItineraryTimeBlock[]
  morning: ItineraryTimeBlock[]
  afternoon: ItineraryTimeBlock[]
  evening: ItineraryTimeBlock[]
  night: ItineraryTimeBlock[]
  freeMinutes: number
  walkingMinutes: number
  transferMinutes: number
}

export interface ItineraryConflict {
  kind: ItineraryConflictKind
  dayDate: string | null
  message: string
  resolved: boolean
  resolution: string | null
}

export interface ItineraryScores {
  comfort: number
  walking: number
  travelEfficiency: number
  familyFriendliness: number
  businessSuitability: number
  overallQuality: number
}

export interface ItineraryExplanation {
  summary: string
  activityReasons: string[]
  orderingReasons: string[]
  hotelFit: string
  flightFit: string
}

export interface ItineraryMetadata {
  totalTravelTimeMinutes: number
  hotelNights: number
  flightDurationMinutes: number
  walkingDurationMinutes: number
  transferDurationMinutes: number
  activityCount: number
  freeHours: number
  dayCount: number
  cityCount: number
  confidence: number
  style: TripStyleKind
  conflictCount: number
  resolvedConflictCount: number
}

export interface ItineraryEngineResult {
  version: string
  enabled: boolean
  ok: boolean
  empty: boolean
  days: ItineraryDayPlan[]
  timeline: ItineraryTimeBlock[]
  conflicts: ItineraryConflict[]
  scores: ItineraryScores
  explanation: ItineraryExplanation
  metadata: ItineraryMetadata
  validationErrors: string[]
  logs: string[]
  latencyMs: number
}

export interface ItineraryLogEntry {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
  meta?: Record<string, unknown>
}

export type ItineraryStructuredLogger = (entry: ItineraryLogEntry) => void

export function createSilentItineraryLogger(): ItineraryStructuredLogger {
  return () => {
    /* retained on engine */
  }
}

export function minutesToLabel(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function dayPartForMinutes(minutes: number): DayPart {
  if (minutes < 12 * 60) return 'morning'
  if (minutes < 17 * 60) return 'afternoon'
  if (minutes < 21 * 60) return 'evening'
  return 'night'
}

export function parseTimeToMinutes(isoOrTime: string | null | undefined): number | null {
  if (!isoOrTime) return null
  const t = isoOrTime.trim()
  const iso = t.match(/T(\d{2}):(\d{2})/)
  if (iso) return Number(iso[1]) * 60 + Number(iso[2])
  const hm = t.match(/^(\d{1,2}):(\d{2})$/)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2])
  const d = new Date(t)
  if (!Number.isNaN(d.getTime())) {
    return d.getUTCHours() * 60 + d.getUTCMinutes()
  }
  return null
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00Z`).getTime()
  const b = new Date(`${end}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

export function eachDateInclusive(start: string, end: string): string[] {
  if (!start || !end || end < start) return start ? [start] : []
  const out: string[] = []
  let cur = start
  while (cur <= end) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}
