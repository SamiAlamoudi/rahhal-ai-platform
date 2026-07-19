/**
 * Sprint 25 — Production Booking Flow (MVP) types.
 * Orchestration state only — no duplicated booking/search/brain business rules.
 */

import type { BookingItem, BookingItemType, BookingSession } from '../booking/bookingTypes'
import type { BookingSelectedItem } from '../booking/bookingSelectionMapper'
import type { BookingSummary, BookingReadinessResult } from '../booking/bookingOrchestrator'
import type { SearchOption, SearchRecommendation } from '../brain/search/types'

export type BookingFlowStage =
  | 'conversation'
  | 'requirements'
  | 'planning'
  | 'execution'
  | 'search_results'
  | 'user_selection'
  | 'booking_session'
  | 'booking_review'
  | 'ready_for_payment'

export type BookingFlowSectionId =
  | 'flights'
  | 'hotels'
  | 'transport'
  | 'activities'
  | 'packages'
  | 'travelers'
  | 'dates'
  | 'price_summary'
  | 'budget_comparison'
  | 'warnings'

export interface BookingFlowBudgetContext {
  amount: number | null
  currency: string | null
}

export interface BookingFlowDatesContext {
  startDate: string | null
  endDate: string | null
  durationDays: number | null
}

export interface BookingFlowTravelerContext {
  adults: number | null
  children: number | null
  infants: number | null
  summary: string | null
}

/** Durable flow snapshot restored on refresh / back navigation. */
export interface BookingFlowState {
  id: string
  conversationId: string | null
  userId: string
  stage: BookingFlowStage
  bookingSessionId: string | null
  travelSessionId: string | null
  currency: string
  /** Last selected payloads (navigation-safe). */
  selectedItems: BookingSelectedItem[]
  /** Optional brain search recommendation snapshot. */
  searchRecommendation: SearchRecommendation | null
  budget: BookingFlowBudgetContext
  dates: BookingFlowDatesContext
  travelers: BookingFlowTravelerContext
  /** Section edit markers — changing one section does not wipe others. */
  lastEditedSection: BookingFlowSectionId | null
  createdAt: string
  updatedAt: string
}

export interface BookingFlowReviewSection {
  id: BookingFlowSectionId
  title: string
  editable: boolean
  items: BookingItem[]
  emptyLabel: string
  summaryLine: string | null
}

export interface BookingFlowBudgetComparison {
  budgetAmount: number | null
  budgetCurrency: string | null
  bookingTotal: number
  bookingCurrency: string
  delta: number | null
  withinBudget: boolean | null
  label: string
}

export interface BookingFlowReviewModel {
  session: BookingSession
  stage: BookingFlowStage
  sections: BookingFlowReviewSection[]
  travelers: BookingFlowTravelerContext
  dates: BookingFlowDatesContext
  priceSummary: BookingSummary
  budgetComparison: BookingFlowBudgetComparison
  warnings: string[]
  readiness: BookingReadinessResult
  readyForPayment: boolean
}

export interface BookingFlowPaymentNav {
  path: '/checkout'
  state: {
    items: unknown[]
    travelSessionId: string | null
    currency: string
    bookingSessionId: string
  }
}

export interface CreateBookingFlowInput {
  userId: string
  conversationId?: string | null
  travelSessionId?: string | null
  currency?: string
  budget?: BookingFlowBudgetContext
  dates?: BookingFlowDatesContext
  travelers?: BookingFlowTravelerContext
}

export interface ApplySelectionInput {
  flowId: string
  items: BookingSelectedItem[]
  /** When set, only replace this booking item type (preserve others). */
  replaceTypes?: BookingItemType[]
  /** Prefer kind-based replace (flight/hotel/transport/activity/package). */
  replaceKinds?: Array<'flight' | 'hotel' | 'transport' | 'activity' | 'package'>
}

export interface ApplySearchOptionSelectionInput {
  flowId: string
  options: SearchOption[]
  /** Replace only these kinds; others stay. */
  replaceKinds?: SearchOption['kind'][]
}

export interface BookingFlowConversationEdit {
  kind:
    | 'cheaper_hotel'
    | 'business_class'
    | 'extend_nights'
    | 'cheaper_flight'
    | 'unknown'
  signal: string
}

export type BookingFlowControllerOptions = {
  /** Inject persistence key prefix (tests). */
  storagePrefix?: string
}
