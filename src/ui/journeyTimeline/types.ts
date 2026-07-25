/**
 * Phase 5 Stage 1 — AI Journey Timeline contracts.
 * Presentation only. No realtime, maps, weather, backend, AI, booking, or notifications.
 */

export type JourneyTimelineLocale = 'ar' | 'en'
export type JourneyTimelineTheme = 'light' | 'dark'

export type JourneyStepId =
  | 'departure'
  | 'airport'
  | 'check_in'
  | 'security'
  | 'boarding'
  | 'flight'
  | 'arrival'
  | 'transportation'
  | 'hotel'
  | 'meetings'
  | 'lunch'
  | 'dinner'
  | 'activities'
  | 'return'

export type JourneyEventStatus =
  | 'completed'
  | 'current'
  | 'upcoming'
  | 'delayed'
  | 'cancelled'
  | 'recommended'

export type JourneyEventKind =
  | 'flight'
  | 'hotel'
  | 'transportation'
  | 'document'
  | 'visa'
  | 'insurance'
  | 'weather'
  | 'currency'
  | 'maps'
  | 'meeting'
  | 'restaurant'
  | 'activity'

export type JourneyLayout =
  | 'vertical'
  | 'horizontal'
  | 'compact'
  | 'daily'
  | 'weekly'

export interface JourneyEventCard {
  id: string
  step: JourneyStepId
  kind: JourneyEventKind
  title: string
  subtitle: string
  timeLabel: string
  status: JourneyEventStatus
  placeholder?: boolean
  dayIndex: number
}

export interface JourneyProgressModel {
  percent: number
  currentStep: JourneyStepId
  remainingTimeLabel: string
  completionLabel: string
}

export interface JourneyTimelineUiState {
  locale: JourneyTimelineLocale
  theme: JourneyTimelineTheme
  layout: JourneyLayout
  events: JourneyEventCard[]
  progress: JourneyProgressModel
  featureEnabled: boolean
}

export const JOURNEY_STEPS: readonly JourneyStepId[] = [
  'departure',
  'airport',
  'check_in',
  'security',
  'boarding',
  'flight',
  'arrival',
  'transportation',
  'hotel',
  'meetings',
  'lunch',
  'dinner',
  'activities',
  'return',
] as const

export const JOURNEY_EVENT_STATUSES: readonly JourneyEventStatus[] = [
  'completed',
  'current',
  'upcoming',
  'delayed',
  'cancelled',
  'recommended',
] as const

export const JOURNEY_EVENT_KINDS: readonly JourneyEventKind[] = [
  'flight',
  'hotel',
  'transportation',
  'document',
  'visa',
  'insurance',
  'weather',
  'currency',
  'maps',
  'meeting',
  'restaurant',
  'activity',
] as const

export const JOURNEY_LAYOUTS: readonly JourneyLayout[] = [
  'vertical',
  'horizontal',
  'compact',
  'daily',
  'weekly',
] as const

export const JOURNEY_TIMELINE_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoAi: false,
  wiredIntoRuntimeCoordinator: false,
  wiredIntoBookingApis: false,
  wiredIntoMapsApis: false,
  wiredIntoWeatherApis: false,
  realtime: false,
  maps: false,
  weather: false,
  backend: false,
  ai: false,
  booking: false,
  notifications: false,
} as const
