/**
 * Phase 4 Stage 5 — Premium Travel Workspace contracts.
 * Presentation models only. No APIs, booking, payments, Amadeus, or AI execution.
 */

export type TravelWorkspaceLocale = 'ar' | 'en'
export type TravelWorkspaceTheme = 'light' | 'dark'

export type TripLifecycleStatus =
  | 'draft'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type TimelinePeriod = 'morning' | 'afternoon' | 'evening'

export type TimelineItemStatus =
  | 'completed'
  | 'upcoming'
  | 'delayed'
  | 'cancelled'
  | 'live'

export type TripProgressPhase =
  | 'preparation'
  | 'travel'
  | 'arrival'
  | 'meetings'
  | 'activities'
  | 'return'
  | 'completed'

export type TravelCardKind =
  | 'flight'
  | 'hotel'
  | 'transport'
  | 'restaurant'
  | 'meeting'
  | 'activity'
  | 'document'
  | 'boarding_pass'
  | 'ticket'
  | 'qr'

export type QuickActionId =
  | 'open_chat'
  | 'open_voice'
  | 'open_knowledge'
  | 'view_documents'
  | 'open_maps'
  | 'contact_support'
  | 'share_trip'
  | 'export_pdf'

export type TravelerCheckInStatus = 'not_started' | 'ready' | 'checked_in'

export interface TripOverviewModel {
  destination: string
  startDate: string
  endDate: string
  durationDays: number
  travelerCount: number
  status: TripLifecycleStatus
  progressPercent: number
  budgetLabel: string
}

export interface TravelerModel {
  id: string
  name: string
  role: string
  avatarInitials: string
  checkInStatus: TravelerCheckInStatus
  passportPlaceholder: boolean
  seatPlaceholder: string | null
  hotelRoomPlaceholder: string | null
}

export interface TimelineItemModel {
  id: string
  period: TimelinePeriod
  title: string
  timeLabel: string
  status: TimelineItemStatus
  kind: TravelCardKind
}

export interface TravelCardModel {
  id: string
  kind: TravelCardKind
  title: string
  subtitle: string
  meta: string
  statusLabel: string
}

export interface DocumentItemModel {
  id: string
  labelKey: string
  kind:
    | 'passport'
    | 'visa'
    | 'insurance'
    | 'hotel_voucher'
    | 'flight_ticket'
    | 'meeting'
    | 'file'
  placeholder: boolean
}

export interface AlertModel {
  id: string
  severity: 'info' | 'warning' | 'critical'
  message: string
}

export interface ChecklistItemModel {
  id: string
  label: string
  done: boolean
}

export interface TripNoteModel {
  id: string
  body: string
  updatedAt: string
}

export interface AttachmentModel {
  id: string
  name: string
  kindLabel: string
}

export interface SharedItemModel {
  id: string
  title: string
  sharedWith: string
}

export interface BudgetSummaryModel {
  totalLabel: string
  spentLabel: string
  remainingLabel: string
  currencyCode: string
}

export interface TripStatisticsModel {
  flights: number
  hotels: number
  meetings: number
  activities: number
  transfers: number
}

export interface TravelWorkspaceUiState {
  locale: TravelWorkspaceLocale
  theme: TravelWorkspaceTheme
  trip: TripOverviewModel
  travelers: TravelerModel[]
  timeline: TimelineItemModel[]
  cards: TravelCardModel[]
  documents: DocumentItemModel[]
  alerts: AlertModel[]
  checklist: ChecklistItemModel[]
  notes: TripNoteModel[]
  attachments: AttachmentModel[]
  sharedItems: SharedItemModel[]
  budget: BudgetSummaryModel
  statistics: TripStatisticsModel
  progressPhase: TripProgressPhase
  featureEnabled: boolean
}

export const TRIP_PROGRESS_PHASES: readonly TripProgressPhase[] = [
  'preparation',
  'travel',
  'arrival',
  'meetings',
  'activities',
  'return',
  'completed',
] as const

export const QUICK_ACTIONS: readonly QuickActionId[] = [
  'open_chat',
  'open_voice',
  'open_knowledge',
  'view_documents',
  'open_maps',
  'contact_support',
  'share_trip',
  'export_pdf',
] as const

export const TRAVEL_CARD_KINDS: readonly TravelCardKind[] = [
  'flight',
  'hotel',
  'transport',
  'restaurant',
  'meeting',
  'activity',
  'document',
  'boarding_pass',
  'ticket',
  'qr',
] as const

/** Isolation: workspace is a separate operational UI — no booking/AI/backends. */
export const TRAVEL_WORKSPACE_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoRuntimeCoordinator: false,
  wiredIntoConversationOrchestrator: false,
  wiredIntoConversationCenter: false,
  wiredIntoVoiceCenter: false,
  wiredIntoKnowledgeCenter: false,
  wiredIntoPlanning: false,
  wiredIntoAi: false,
  wiredIntoSearchEngine: false,
  wiredIntoDecisionEngine: false,
  wiredIntoTravelIntelligence: false,
  wiredIntoExperienceLayer: false,
  bookingProviders: false,
  amadeus: false,
  payments: false,
  backend: false,
  apis: false,
} as const
