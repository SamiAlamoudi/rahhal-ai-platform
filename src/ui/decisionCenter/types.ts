/**
 * Phase 5 Stage 2 — AI Decision Center contracts.
 * Presentation only. No backend, realtime, booking/maps/weather APIs, or actual AI reasoning.
 */

export type DecisionCenterLocale = 'ar' | 'en'
export type DecisionCenterTheme = 'light' | 'dark'

export type DecisionType =
  | 'flight_choice'
  | 'hotel_choice'
  | 'transportation'
  | 'activity'
  | 'restaurant'
  | 'meeting_time'
  | 'budget_recommendation'
  | 'travel_route'

export type DecisionStateTag =
  | 'recommended'
  | 'alternative'
  | 'best_value'
  | 'fastest'
  | 'luxury'
  | 'budget'
  | 'eco'

export interface DecisionOptionModel {
  id: string
  title: string
  subtitle: string
  tags: DecisionStateTag[]
  costLabel: string
  timeLabel: string
  comfortScore: number
  riskLabel: string
  travelScore: number
}

export interface DecisionComparisonModel {
  costDeltaLabel: string
  timeDeltaLabel: string
  comfortDeltaLabel: string
}

export interface DecisionTreeNode {
  id: string
  label: string
  children?: DecisionTreeNode[]
}

export interface DecisionCenterUiState {
  locale: DecisionCenterLocale
  theme: DecisionCenterTheme
  decisionType: DecisionType
  summary: string
  whyRecommended: string
  recommendationReason: string
  confidence: number
  pros: string[]
  cons: string[]
  riskIndicators: string[]
  options: DecisionOptionModel[]
  comparison: DecisionComparisonModel
  tree: DecisionTreeNode
  timelineImpact: string[]
  featureEnabled: boolean
}

export const DECISION_TYPES: readonly DecisionType[] = [
  'flight_choice',
  'hotel_choice',
  'transportation',
  'activity',
  'restaurant',
  'meeting_time',
  'budget_recommendation',
  'travel_route',
] as const

export const DECISION_STATE_TAGS: readonly DecisionStateTag[] = [
  'recommended',
  'alternative',
  'best_value',
  'fastest',
  'luxury',
  'budget',
  'eco',
] as const

export const DECISION_CENTER_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoAi: false,
  wiredIntoRuntime: false,
  wiredIntoBooking: false,
  wiredIntoMaps: false,
  wiredIntoWeather: false,
  wiredIntoNotifications: false,
  backend: false,
  realtime: false,
  bookingApis: false,
  weatherApis: false,
  mapsApis: false,
  actualAiReasoning: false,
} as const
