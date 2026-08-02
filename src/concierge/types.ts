import type { LocaleCode } from '../brain/types'

export type TravelDnaTrait =
  | 'explorer'
  | 'luxury'
  | 'family'
  | 'business'
  | 'adventure'
  | 'relaxation'
  | 'shopping'
  | 'culture'
  | 'food'

export type ConciergeMemoryFact = {
  id: string
  kind:
    | 'airline'
    | 'hotel'
    | 'cabin'
    | 'travel_style'
    | 'food'
    | 'budget'
    | 'destination'
    | 'family'
    | 'previous_trip'
  label: string
  value: string
  naturalLine: string
}

export type ExplainedRecommendation = {
  id: string
  kind: 'flight' | 'hotel' | 'package' | 'activity' | 'restaurant'
  title: string
  subtitle: string
  priceLabel?: string
  why: string
  pros: string[]
  cons: string[]
  confidence: number
  alternatives: Array<{ id: string; title: string; why: string }>
  badges: string[]
}

export type DecisionTimelineEntry = {
  id: string
  at: string
  title: string
  summary: string
  status: 'active' | 'superseded' | 'restored'
  payload: Record<string, string>
}

export type TripIntelSectionId =
  | 'best_time'
  | 'weather'
  | 'visa'
  | 'currency'
  | 'safety'
  | 'local_tips'
  | 'dress_code'
  | 'time_difference'
  | 'internet'
  | 'power_adapter'
  | 'transportation'
  | 'airport_tips'
  | 'cultural_etiquette'
  | 'emergency_numbers'

export type TripIntelSection = {
  id: TripIntelSectionId
  title: string
  body: string
  tone: 'calm' | 'caution' | 'highlight'
}

export type ReadinessKey =
  | 'preparation'
  | 'budget'
  | 'packing'
  | 'flight'
  | 'hotel'
  | 'visa'
  | 'weather'

export type TravelDashboardModel = {
  tripScore: number
  readiness: Record<ReadinessKey, number>
  headline: string
  locale: LocaleCode
}

export type FollowUpQuestion = {
  id: string
  /** Dedupe key so the brain never repeats the same consultant ask. */
  key: string
  text: string
  reason: string
}

export type TravelDnaProfile = {
  primary: TravelDnaTrait
  traits: Array<{ trait: TravelDnaTrait; score: number }>
  summary: string
}

export type ConciergeBundle = {
  memoryFacts: ConciergeMemoryFact[]
  memoryNarration: string
  recommendations: ExplainedRecommendation[]
  decisionTimeline: DecisionTimelineEntry[]
  tripIntel: TripIntelSection[]
  dashboard: TravelDashboardModel
  followUps: FollowUpQuestion[]
  dna: TravelDnaProfile
  emptyInspiration: {
    title: string
    body: string
    cta: string
    illustration: 'horizon' | 'dune' | 'companion' | 'atlas'
  }
}
