/**
 * Phase 5 Stage 3 — AI Insights Center contracts.
 * Presentation only. No backend, analytics engine, AI reasoning, or external APIs.
 */

export type InsightsCenterLocale = 'ar' | 'en'
export type InsightsCenterTheme = 'light' | 'dark'

export type InsightsFilterId =
  | 'this_trip'
  | 'this_month'
  | 'this_year'
  | 'lifetime'
  | 'business'
  | 'personal'

export interface InsightsStatCard {
  id: string
  labelKey: string
  value: string
  trendLabel?: string
}

export interface InsightsBreakdownItem {
  id: string
  label: string
  amountLabel: string
  percent: number
}

export interface InsightsPlaceItem {
  id: string
  name: string
  count: number
}

export interface InsightsTripCountModel {
  upcoming: number
  completed: number
  cancelled: number
}

export interface InsightsAchievementBadge {
  id: string
  label: string
  earned: boolean
}

export interface InsightsTimelinePoint {
  id: string
  label: string
  valueLabel: string
}

export interface InsightsCenterUiState {
  locale: InsightsCenterLocale
  theme: InsightsCenterTheme
  activeFilter: InsightsFilterId
  overview: string
  statistics: InsightsStatCard[]
  budgetTotalLabel: string
  savingsLabel: string
  costBreakdown: InsightsBreakdownItem[]
  visitedCountries: InsightsPlaceItem[]
  visitedCities: InsightsPlaceItem[]
  favoriteAirlines: InsightsPlaceItem[]
  favoriteHotels: InsightsPlaceItem[]
  tripFrequencyLabel: string
  tripCounts: InsightsTripCountModel
  travelHealthScore: number
  carbonFootprintPlaceholder: string
  passportStatusPlaceholder: string
  visaStatusPlaceholder: string
  loyaltySummaryPlaceholder: string
  journeyActivity: InsightsStatCard[]
  timelineSummary: InsightsTimelinePoint[]
  badges: InsightsAchievementBadge[]
  featureEnabled: boolean
}

export const INSIGHTS_FILTERS: readonly InsightsFilterId[] = [
  'this_trip',
  'this_month',
  'this_year',
  'lifetime',
  'business',
  'personal',
] as const

export const INSIGHTS_CENTER_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoAi: false,
  wiredIntoRuntime: false,
  wiredIntoBooking: false,
  wiredIntoMaps: false,
  wiredIntoWeather: false,
  wiredIntoNotifications: false,
  backend: false,
  realtime: false,
  analyticsEngine: false,
  aiReasoning: false,
  weatherApis: false,
  bookingApis: false,
  mapsApis: false,
} as const
