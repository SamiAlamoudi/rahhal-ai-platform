/**
 * Sprint 17 — Smart Itinerary domain.
 * TripItinerary references BookingSession (+ optional Order). BookingSession remains SoT.
 */

export type ItineraryLocale = 'ar' | 'en'

export type TimelineEventType =
  | 'departure_prep'
  | 'airport_arrival'
  | 'flight_depart'
  | 'flight_arrive'
  | 'hotel_checkin'
  | 'transport'
  | 'daily_schedule'
  | 'return_flight'
  | 'free_time'

export interface TimelineItem {
  id: string
  type: TimelineEventType
  at: string | null
  labelAr: string
  labelEn: string
  detailAr: string
  detailEn: string
  /** Placeholder / future-dynamic flag. */
  placeholder?: boolean
}

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'free_time'

export interface DayPartBlock {
  part: DayPart
  titleAr: string
  titleEn: string
  bodyAr: string
  bodyEn: string
  /** Architecture-ready for LLM-generated content. */
  generatedBy: 'placeholder' | 'rule' | 'llm'
}

export interface DayPlan {
  dayIndex: number
  date: string | null
  titleAr: string
  titleEn: string
  parts: DayPartBlock[]
  notesAr: string
  notesEn: string
}

export type TravelInsightKind =
  | 'airport_arrival'
  | 'travel_time'
  | 'timezone'
  | 'packing'
  | 'weather'
  | 'currency'
  | 'visa'

export interface TravelInsight {
  id: string
  kind: TravelInsightKind
  titleAr: string
  titleEn: string
  bodyAr: string
  bodyEn: string
  /** Architecture-ready only — not live integrations yet. */
  architectureReady: boolean
  tone: 'info' | 'tip' | 'warning' | 'neutral'
}

export interface TripSummary {
  titleAr: string
  titleEn: string
  origin: string
  destination: string
  departureTime: string | null
  arrivalTime: string | null
  durationDays: number
  passengerCount: number
  airline: string
  bookingReference: string
  orderId: string | null
  orderNumber: string | null
}

/** Product name: TripItinerary (Sprint 17). */
export interface TripItinerary {
  id: string
  bookingSessionId: string
  orderId: string | null
  summary: TripSummary
  timeline: TimelineItem[]
  days: DayPlan[]
  insights: TravelInsight[]
  createdAt: string
  updatedAt: string
  /** Extensibility hook for future LLM regeneration. */
  generationMode: 'rule_based' | 'llm'
  version: 1
}

export interface GenerateItineraryInput {
  bookingSessionId: string
  /** Optional clock for deterministic tests. */
  now?: Date
  includeInsights?: boolean
  includeDailyPlanner?: boolean
}
