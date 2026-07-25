/**
 * Integration Sprint 10 — Live Disruption Recovery contracts.
 * Detect → impact → recover → replan → explain. Live alerts prepared, not enabled.
 */

export const INTEGRATION_DISRUPTION_RECOVERY_VERSION =
  '1.0.0-integration-disruption-recovery'

export type DisruptionKind =
  | 'flight_delay'
  | 'flight_cancellation'
  | 'gate_change'
  | 'missed_connection'
  | 'hotel_overbooking'
  | 'late_check_in'
  | 'activity_cancellation'
  | 'weather_disruption'

export type DisruptionRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type RecoveryStrategy =
  | 'best'
  | 'cheapest'
  | 'fastest'
  | 'minimal_disruption'
  | 'premium'

export interface DetectedLiveDisruption {
  id: string
  kind: DisruptionKind
  summaryEn: string
  summaryAr: string
  delayMinutes: number
  risk: DisruptionRiskLevel
  detectedAt: string
  rawText: string | null
}

export interface DisruptionImpact {
  timeline: boolean
  hotel: boolean
  transfers: boolean
  meetings: boolean
  activities: boolean
  budget: boolean
  stressScore: number
  overnightLikely: boolean
  summaryEn: string
  summaryAr: string
}

export interface RecoveryPlan {
  id: string
  strategy: RecoveryStrategy
  titleEn: string
  titleAr: string
  stepsEn: string[]
  stepsAr: string[]
  extraCost: number
  currency: string
  timeSavedMinutes: number
  residualDelayMinutes: number
  score: number
  whyEn: string
  whyAr: string
}

export interface AutoReplanSnapshot {
  timelineShiftedMinutes: number
  hotelCheckInAdjusted: boolean
  transfersAdjusted: boolean
  meetingsAdjusted: boolean
  activitiesAdjusted: boolean
  budgetDelta: number
  notesEn: string[]
  notesAr: string[]
}

export type LiveAlertSource = 'airline' | 'hotel' | 'weather'

export interface LiveDisruptionAlert {
  id: string
  source: LiveAlertSource
  kind: DisruptionKind
  titleEn: string
  titleAr: string
  receivedAt: string
  live: false
}

/** Prepared provider abstraction — no live APIs yet. */
export interface LiveDisruptionAlertProvider {
  readonly providerId: string
  readonly live: boolean
  poll(input: {
    tripId?: string | null
    signal?: AbortSignal
  }): Promise<LiveDisruptionAlert[]>
}

export type DisruptionRecoveryIntent =
  | 'report_disruption'
  | 'what_now'
  | 'choose_recovery'
  | 'unknown'

export interface DisruptionRecoveryResult {
  version: string
  enabled: boolean
  ok: boolean
  intent: DisruptionRecoveryIntent
  disruption: DetectedLiveDisruption | null
  impact: DisruptionImpact | null
  risk: DisruptionRiskLevel | null
  plans: RecoveryPlan[]
  primary: RecoveryPlan | null
  replan: AutoReplanSnapshot | null
  liveAlertsReady: boolean
  consultantSummaryEn: string
  consultantSummaryAr: string
  latencyMs: number
  logs: string[]
}
