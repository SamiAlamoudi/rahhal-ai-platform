/**
 * Sprint 37 — Travel Disruption & Smart Recovery domain types.
 */

export type DisruptionEventType =
  | 'flight_delayed'
  | 'flight_cancelled'
  | 'gate_changed'
  | 'schedule_changed'
  | 'missed_connection'
  | 'hotel_overbooking'
  | 'hotel_unavailable'
  | 'car_unavailable'
  | 'activity_cancelled'
  | 'airport_closure'
  | 'weather_disruption'
  | 'strike'
  | 'visa_rejection'
  | 'border_restriction'

export type DisruptionSeverity = 'low' | 'medium' | 'high' | 'critical'

export type RecoveryOptionKind =
  | 'alternative_flight'
  | 'alternative_hotel'
  | 'alternative_car'
  | 'alternative_activity'
  | 'alternative_transport'
  | 'alternative_route'

export type TravelerProfileHint =
  | 'family'
  | 'business'
  | 'leisure'
  | 'solo'
  | 'unknown'

export interface DisruptionContext {
  tripId: string
  userId: string
  conversationId?: string | null
  destination: string
  origin?: string | null
  currency: string
  hotelName?: string | null
  flightConfirmation?: string | null
  hotelConfirmation?: string | null
  startDate?: string | null
  endDate?: string | null
  cabinClass?: string | null
  hotelStars?: number | null
  preferredAirlines?: string[]
  preferredHotels?: string[]
  loyaltyPrograms?: string[]
  travelerProfile?: TravelerProfileHint
  familyTravel?: boolean
  businessTravel?: boolean
  visaRestricted?: boolean
  conversationNotes?: string[]
  currentDelayMinutes?: number
  gate?: string | null
  previousGate?: string | null
}

export interface DetectedDisruption {
  disruptionId: string
  eventType: DisruptionEventType
  detectedAt: string
  severity: DisruptionSeverity
  summary: string
  delayMinutes: number
  affectedServices: Array<'flight' | 'hotel' | 'car' | 'activity' | 'transport' | 'visa'>
  rawSignal: Record<string, unknown>
}

export interface PassengerImpact {
  travelersAffected: number
  overnightRequired: boolean
  connectionAtRisk: boolean
  hotelSameDayImpact: boolean
  activitiesImpacted: number
  transportImpacted: boolean
  stressScore: number
  summary: string
}

export interface RecoveryOption {
  optionId: string
  kind: RecoveryOptionKind
  title: string
  description: string
  providerId: string
  extraCost: number
  currency: string
  delayReductionMinutes: number
  arrivalDeltaMinutes: number
  confidence: number
  factors: Record<string, number>
  reasons: string[]
  metadata: Record<string, unknown>
}

export interface RankedRecoveryPlan {
  planId: string
  rank: number
  title: string
  options: RecoveryOption[]
  totalExtraCost: number
  currency: string
  estimatedDelayMinutes: number
  confidenceScore: number
  score: number
  factors: Record<string, number>
  reasons: string[]
  explanation: string
}

export interface TripUpdateResult {
  itineraryUpdated: boolean
  hotelDatesMoved: boolean
  activitiesMoved: boolean
  transportationUpdated: boolean
  remindersUpdated: boolean
  documentsRegenerated: boolean
  newCheckInDate: string | null
  shiftedActivityDates: string[]
  notes: string[]
}

export interface DisruptionHandlingResult {
  disruption: DetectedDisruption
  impact: PassengerImpact
  plans: RankedRecoveryPlan[]
  selectedPlan: RankedRecoveryPlan | null
  tripUpdate: TripUpdateResult | null
  estimatedExtraCost: number
  estimatedDelayMinutes: number
  confidenceScore: number
  explanation: string
  notifications: Array<{ trigger: string; title: string; body: string }>
  applied: boolean
}

export interface DisruptionHandleInput {
  eventType: DisruptionEventType
  context: DisruptionContext
  signal?: Record<string, unknown>
  autoApplyBestPlan?: boolean
  delayMinutes?: number
  locale?: 'ar' | 'en'
}
