/**
 * Integration Sprint 7 — Live Trip Companion contracts.
 * Guides traveler before / during / after the trip. No live maps/GPS yet.
 */

export const INTEGRATION_TRIP_COMPANION_VERSION = '1.0.0-integration-trip-companion'

export type TripSessionState =
  | 'upcoming'
  | 'travel_day'
  | 'in_transit'
  | 'checked_in'
  | 'exploring'
  | 'meeting_mode'
  | 'returning'
  | 'completed'

export type TimelineEventKind =
  | 'flight'
  | 'hotel_check_in'
  | 'hotel_check_out'
  | 'activity'
  | 'meeting'
  | 'restaurant'
  | 'transfer'
  | 'airport'
  | 'custom'

export type TimelineEventStatus =
  | 'upcoming'
  | 'current'
  | 'done'
  | 'late'
  | 'missed'
  | 'skipped'
  | 'rescheduled'

export interface CompanionTimelineEvent {
  id: string
  kind: TimelineEventKind
  titleEn: string
  titleAr: string
  startAt: string
  endAt: string | null
  locationLabel: string | null
  status: TimelineEventStatus
  remainingMinutes: number | null
  notesEn?: string
  notesAr?: string
}

export interface TravelTimelineSnapshot {
  current: CompanionTimelineEvent | null
  next: CompanionTimelineEvent | null
  upcoming: CompanionTimelineEvent[]
  late: CompanionTimelineEvent[]
  missed: CompanionTimelineEvent[]
  remainingTodayMinutes: number
}

export type CompanionNotificationKind =
  | 'upcoming_flight'
  | 'hotel_check_in'
  | 'meeting_reminder'
  | 'restaurant_reservation'
  | 'airport_departure'
  | 'passport_reminder'
  | 'gate_reminder'
  | 'boarding_reminder'

export interface CompanionNotification {
  id: string
  kind: CompanionNotificationKind
  titleEn: string
  titleAr: string
  bodyEn: string
  bodyAr: string
  fireAt: string
  relatedEventId: string | null
  channelReady: boolean
}

export type CompanionDisruptionKind =
  | 'flight_delayed'
  | 'hotel_unavailable'
  | 'meeting_changed'
  | 'traffic_delay'
  | 'activity_skipped'

export interface CompanionDisruption {
  kind: CompanionDisruptionKind
  detailEn: string
  detailAr: string
  delayMinutes?: number | null
  eventId?: string | null
}

export interface CompanionLocationRef {
  id: string
  labelEn: string
  labelAr: string
  city: string | null
  country: string | null
  /** Future GPS — null until live location layer. */
  coordinates: { lat: number; lng: number } | null
  accuracyMeters: number | null
  source: 'plan' | 'hotel' | 'manual' | 'gps_future'
}

export interface CompanionLocationLayer {
  current: CompanionLocationRef | null
  hotel: CompanionLocationRef | null
  city: CompanionLocationRef | null
  nearbyReady: boolean
  walkingRoutesReady: boolean
  mapsReady: boolean
}

export type CompanionEmergencyKind =
  | 'lost_passport'
  | 'medical_help'
  | 'emergency_numbers'
  | 'embassy_lookup'
  | 'safe_transport'

export interface CompanionEmergencySupport {
  kind: CompanionEmergencyKind
  titleEn: string
  titleAr: string
  stepsEn: string[]
  stepsAr: string[]
  contactsEn: string[]
  contactsAr: string[]
  liveIntegration: false
}

export interface TripCompanionContextMemory {
  tripId: string | null
  currentHotel: string | null
  currentCity: string | null
  todaysPlanSummaryEn: string
  todaysPlanSummaryAr: string
  preferences: string[]
  budgetAmount: number | null
  budgetCurrency: string | null
  sessionState: TripSessionState
}

export interface TripSession {
  id: string
  state: TripSessionState
  tripId: string | null
  destination: string | null
  startDate: string | null
  endDate: string | null
  updatedAt: string
}

export type CompanionAssistantIntent =
  | 'what_now'
  | 'when_leave'
  | 'am_i_late'
  | 'nearby'
  | 'status'
  | 'emergency'
  | 'unknown'

export interface TripCompanionResult {
  version: string
  enabled: boolean
  ok: boolean
  session: TripSession | null
  timeline: TravelTimelineSnapshot | null
  notifications: CompanionNotification[]
  disruptions: CompanionDisruption[]
  replanned: boolean
  location: CompanionLocationLayer | null
  emergency: CompanionEmergencySupport | null
  context: TripCompanionContextMemory | null
  assistantIntent: CompanionAssistantIntent
  consultantSummaryAr: string
  consultantSummaryEn: string
  latencyMs: number
  logs: string[]
}
