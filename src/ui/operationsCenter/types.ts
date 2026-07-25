/**
 * Phase 5 Stage 7 — Operations Center contracts.
 * Presentation only. No Runtime, AI, realtime, or external APIs.
 */

export type OperationsCenterLocale = 'ar' | 'en'
export type OperationsCenterTheme = 'light' | 'dark'

export type OperationsFilterId =
  | 'all'
  | 'active'
  | 'delayed'
  | 'incidents'
  | 'approvals'
  | 'visa'

export type OperationsPriority = 'low' | 'medium' | 'high' | 'critical'
export type OperationsRisk = 'low' | 'medium' | 'high'

export interface OperationsMetricCard {
  id: string
  label: string
  value: string
  trendLabel?: string
}

export interface OperationsTripCard {
  id: string
  title: string
  subtitle: string
  statusLabel: string
  priority: OperationsPriority
  risk: OperationsRisk
}

export interface OperationsQueueCard {
  id: string
  title: string
  meta: string
  priority: OperationsPriority
  countLabel: string
}

export interface OperationsIncidentCard {
  id: string
  title: string
  severityLabel: string
  statusLabel: string
}

export interface OperationsTravelerCard {
  id: string
  name: string
  requestLabel: string
  priority: OperationsPriority
}

export interface OperationsProviderCard {
  id: string
  name: string
  statusLabel: string
  slaLabel: string
}

export interface OperationsTimelineItem {
  id: string
  whenLabel: string
  title: string
}

export interface OperationsActivityItem {
  id: string
  actor: string
  action: string
}

export interface OperationsSlaMetric {
  id: string
  label: string
  valueLabel: string
  percent: number
}

export interface OperationsAgentWorkload {
  id: string
  name: string
  loadLabel: string
  percent: number
}

export interface OperationsCenterUiState {
  locale: OperationsCenterLocale
  theme: OperationsCenterTheme
  activeFilter: OperationsFilterId
  searchQuery: string
  overview: string
  metrics: OperationsMetricCard[]
  activeTrips: OperationsTripCard[]
  upcomingTrips: OperationsTripCard[]
  delayedTrips: OperationsTripCard[]
  travelerRequests: OperationsTravelerCard[]
  supportQueue: OperationsQueueCard[]
  incidents: OperationsIncidentCard[]
  emergencyItems: OperationsIncidentCard[]
  approvalQueue: OperationsQueueCard[]
  bookingQueue: OperationsQueueCard[]
  visaQueue: OperationsQueueCard[]
  providers: OperationsProviderCard[]
  slaMetrics: OperationsSlaMetric[]
  agentWorkload: OperationsAgentWorkload[]
  notificationsQueue: OperationsQueueCard[]
  activityFeed: OperationsActivityItem[]
  auditTimeline: OperationsTimelineItem[]
  calendarDays: string[]
  mapPlaceholder: string
  chartPlaceholder: string
  featureEnabled: boolean
}

export const OPERATIONS_FILTERS: readonly OperationsFilterId[] = [
  'all',
  'active',
  'delayed',
  'incidents',
  'approvals',
  'visa',
] as const

export const OPERATIONS_CENTER_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoAi: false,
  wiredIntoRuntime: false,
  wiredIntoRealtime: false,
  wiredIntoDatabase: false,
  wiredIntoFirebase: false,
  wiredIntoNotifications: false,
  wiredIntoBookingApis: false,
  wiredIntoMaps: false,
  wiredIntoPayments: false,
  authentication: false,
  backend: false,
} as const
