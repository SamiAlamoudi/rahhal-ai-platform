/**
 * Phase 4 Stage 6 — Executive Dashboard + Notification Center contracts.
 * Presentation layer only. No push, realtime, Firebase, APIs, booking, or AI.
 */

export type ExecutiveLocale = 'ar' | 'en'
export type ExecutiveTheme = 'light' | 'dark'

export type NotificationPriority = 'normal' | 'priority' | 'critical' | 'reminder'

export type NotificationCategory =
  | 'travel_updates'
  | 'flight_changes'
  | 'hotel_changes'
  | 'meeting_updates'
  | 'transportation'
  | 'weather'
  | 'visa'
  | 'system'

export type NotificationReadState = 'unread' | 'read'

export type DashboardFilterId =
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'trips'
  | 'meetings'
  | 'flights'
  | 'hotels'
  | 'transportation'
  | 'documents'

export type ActionCardId =
  | 'view_trip'
  | 'view_traveler'
  | 'open_timeline'
  | 'open_documents'
  | 'open_calendar'

export type CalendarViewMode = 'monthly' | 'weekly' | 'daily' | 'agenda'

export interface ExecutiveMetricModel {
  id: string
  labelKey: string
  value: number
}

export interface UpcomingTripCard {
  id: string
  destination: string
  datesLabel: string
  statusLabel: string
}

export interface ScheduleItem {
  id: string
  timeLabel: string
  title: string
  kind: 'meeting' | 'flight' | 'hotel' | 'transport' | 'other'
}

export interface BoardMeetingCard {
  id: string
  title: string
  timeLabel: string
  location: string
}

export interface TravelerStatusCard {
  id: string
  name: string
  statusLabel: string
}

export interface PendingActionCard {
  id: string
  title: string
  dueLabel: string
}

export interface ActivityItem {
  id: string
  summary: string
  atLabel: string
}

export interface NotificationItem {
  id: string
  title: string
  body: string
  createdAt: string
  readState: NotificationReadState
  priority: NotificationPriority
  category: NotificationCategory
}

export interface ExecutiveSearchState {
  query: string
  category: DashboardFilterId | 'all'
  showRecent: boolean
  showFavorites: boolean
}

export interface ExecutiveDashboardUiState {
  locale: ExecutiveLocale
  theme: ExecutiveTheme
  activeFilter: DashboardFilterId
  calendarView: CalendarViewMode
  search: ExecutiveSearchState
  metrics: ExecutiveMetricModel[]
  upcomingTrips: UpcomingTripCard[]
  todaySchedule: ScheduleItem[]
  boardMeetings: BoardMeetingCard[]
  travelerStatuses: TravelerStatusCard[]
  pendingActions: PendingActionCard[]
  recentActivity: ActivityItem[]
  notifications: NotificationItem[]
  travelProgressPercent: number
  featureEnabled: boolean
}

export const DASHBOARD_FILTERS: readonly DashboardFilterId[] = [
  'today',
  'tomorrow',
  'this_week',
  'trips',
  'meetings',
  'flights',
  'hotels',
  'transportation',
  'documents',
] as const

export const ACTION_CARDS: readonly ActionCardId[] = [
  'view_trip',
  'view_traveler',
  'open_timeline',
  'open_documents',
  'open_calendar',
] as const

export const CALENDAR_VIEWS: readonly CalendarViewMode[] = [
  'monthly',
  'weekly',
  'daily',
  'agenda',
] as const

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  'travel_updates',
  'flight_changes',
  'hotel_changes',
  'meeting_updates',
  'transportation',
  'weather',
  'visa',
  'system',
] as const

export const EXECUTIVE_DASHBOARD_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoRuntimeCoordinator: false,
  wiredIntoAi: false,
  wiredIntoChat: false,
  wiredIntoVoice: false,
  wiredIntoKnowledge: false,
  wiredIntoBooking: false,
  pushNotifications: false,
  realtime: false,
  firebase: false,
  backend: false,
  apiCalls: false,
  calendarSync: false,
  aiDecisions: false,
} as const
