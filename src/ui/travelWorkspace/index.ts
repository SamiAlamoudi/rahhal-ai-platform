/**
 * Phase 4 Stage 5 — Premium Travel Workspace barrel.
 *
 * Isolated operational UI package. Not wired into production main.tsx,
 * AI, planning, Runtime Coordinator, Conversation/Voice/Knowledge centers,
 * booking providers, Amadeus, or payments.
 * Gated by `ui.travel_workspace` (default OFF).
 */

export {
  TRAVEL_WORKSPACE_FEATURE_ID,
  isTravelWorkspaceEnabled,
  TravelWorkspaceRegistry,
} from './travelWorkspaceRegistry'

export type {
  TravelWorkspaceLocale,
  TravelWorkspaceTheme,
  TripLifecycleStatus,
  TimelinePeriod,
  TimelineItemStatus,
  TripProgressPhase,
  TravelCardKind,
  QuickActionId,
  TravelerCheckInStatus,
  TripOverviewModel,
  TravelerModel,
  TimelineItemModel,
  TravelCardModel,
  DocumentItemModel,
  AlertModel,
  ChecklistItemModel,
  TripNoteModel,
  AttachmentModel,
  SharedItemModel,
  BudgetSummaryModel,
  TripStatisticsModel,
  TravelWorkspaceUiState,
} from './types'

export {
  TRIP_PROGRESS_PHASES,
  QUICK_ACTIONS,
  TRAVEL_CARD_KINDS,
  TRAVEL_WORKSPACE_ISOLATION,
} from './types'

export {
  WORKSPACE_TOKENS,
  workspaceTokenCssVariables,
} from './design/workspaceTokens'

export {
  createDemoTravelWorkspaceState,
  assertTravelWorkspaceIsolation,
} from './state/travelWorkspaceState'

export { TravelWorkspace, tryRenderTravelWorkspace } from './components/TravelWorkspace'
export type { TravelWorkspaceProps } from './components/TravelWorkspace'
export { TravelCard } from './components/TravelCard'
export type { TravelCardProps } from './components/TravelCard'

export { Dashboard } from './dashboard'
export { TripTimeline } from './tripTimeline'
export { FlightCards } from './flightCards'
export { HotelCards } from './hotelCards'
export { TransportCards } from './transportCards'
export { MeetingCards } from './meetingCards'
export { ActivityCards } from './activityCards'
export { DailyAgenda } from './dailyAgenda'
export { TripOverview } from './tripOverview'
export { TravelerList } from './travelerList'
export { DocumentsPanel } from './documentsPanel'
export { TicketCards } from './ticketCards'
export { QrCards } from './qrCards'
export { TripStatus } from './tripStatus'
export { TripProgress } from './tripProgress'
export { BudgetSummary } from './budgetSummary'
export { WeatherPanel } from './weatherPanel'
export { CurrencyPanel } from './currencyPanel'
export { VisaPanel } from './visaPanel'
export { AlertsPanel } from './alertsPanel'
export { QuickActions } from './quickActions'
export { MapPreview } from './mapPreview'
export { TripStatistics } from './tripStatistics'
export { TripNotes } from './tripNotes'
export { Attachments } from './attachments'
export { Checklists } from './checklists'
export { SharedItems } from './sharedItems'

/** Architecture inventory for docs / tests. */
export const TRAVEL_WORKSPACE_ARCHITECTURE = {
  version: '4.5.0-travel-workspace',
  featureId: 'ui.travel_workspace' as const,
  wiredIntoProductionRoutes: false,
  presentationOnly: true,
  modules: [
    'dashboard',
    'tripTimeline',
    'flightCards',
    'hotelCards',
    'transportCards',
    'meetingCards',
    'activityCards',
    'dailyAgenda',
    'tripOverview',
    'travelerList',
    'documentsPanel',
    'ticketCards',
    'qrCards',
    'tripStatus',
    'tripProgress',
    'budgetSummary',
    'weatherPanel',
    'currencyPanel',
    'visaPanel',
    'alertsPanel',
    'quickActions',
    'mapPreview',
    'tripStatistics',
    'tripNotes',
    'attachments',
    'checklists',
    'sharedItems',
  ] as const,
  ...TRAVEL_WORKSPACE_ISOLATION,
} as const
