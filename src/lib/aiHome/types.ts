/**
 * Sprint 16 — AI Home Experience domain (conversation-first).
 * Projects BookingSession / Orders into home widgets — no duplicated SoT.
 */

export type HomeLocale = 'ar' | 'en'

export type SuggestedPromptId =
  | 'weekend'
  | 'cheap_europe'
  | 'honeymoon'
  | 'family'
  | 'business'
  | 'continue_booking'
  | 'tokyo'
  | 'budget_5000'
  | 'dubai_business'

export interface SuggestedPrompt {
  id: SuggestedPromptId
  icon: string
  labelAr: string
  labelEn: string
  promptAr: string
  promptEn: string
  /** When true, resume booking instead of starting a chat. */
  resumeBooking?: boolean
}

export type ContinueBookingStepId =
  | 'select_flight'
  | 'passengers'
  | 'review'
  | 'confirm'
  | 'payment'
  | 'complete'

export interface ContinueBookingStep {
  id: ContinueBookingStepId
  labelAr: string
  labelEn: string
  done: boolean
  current: boolean
}

export interface ContinueBookingModel {
  sessionId: string
  bookingReference: string
  title: string
  status: string
  statusLabelAr: string
  statusLabelEn: string
  remainingSteps: ContinueBookingStep[]
  resumePath: string
  resumeState?: Record<string, unknown>
}

export type TravelCardKind =
  | 'upcoming_trip'
  | 'recent_order'
  | 'saved_search'
  | 'recommended_destination'
  | 'travel_inspiration'
  | 'price_alert'

export interface TravelSmartCardModel {
  id: string
  kind: TravelCardKind
  titleAr: string
  titleEn: string
  subtitleAr: string
  subtitleEn: string
  metaAr?: string
  metaEn?: string
  href: string
  statusChip?: { labelAr: string; labelEn: string; tone: 'neutral' | 'info' | 'success' | 'warning' }
}

export interface AiHomeGreeting {
  timeGreetingAr: string
  timeGreetingEn: string
  welcomeAr: string
  welcomeEn: string
  questionAr: string
  questionEn: string
}

export interface AiHomeModel {
  greeting: AiHomeGreeting
  suggestions: SuggestedPrompt[]
  continueBooking: ContinueBookingModel | null
  travelCards: TravelSmartCardModel[]
  upcomingCount: number
  recentOrderCount: number
}
