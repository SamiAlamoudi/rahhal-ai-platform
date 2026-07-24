/**
 * Phase 4 Stage 6 — Executive Dashboard + Notification Center barrel.
 *
 * Isolated presentation package. Not wired into production main.tsx,
 * AI, Runtime Coordinator, Chat, Voice, Knowledge, or Booking.
 * Gated by `ui.executive_dashboard` (default OFF).
 */

import { EXECUTIVE_DASHBOARD_ISOLATION as ED_ISOLATION } from './types'

export {
  EXECUTIVE_DASHBOARD_FEATURE_ID,
  isExecutiveDashboardEnabled,
  ExecutiveDashboardRegistry,
} from './executiveDashboardRegistry'

export type {
  ExecutiveLocale,
  ExecutiveTheme,
  NotificationPriority,
  NotificationCategory,
  NotificationReadState,
  DashboardFilterId,
  ActionCardId,
  CalendarViewMode,
  ExecutiveMetricModel,
  UpcomingTripCard,
  ScheduleItem,
  BoardMeetingCard,
  TravelerStatusCard,
  PendingActionCard,
  ActivityItem,
  NotificationItem,
  ExecutiveSearchState,
  ExecutiveDashboardUiState,
} from './types'

export {
  DASHBOARD_FILTERS,
  ACTION_CARDS,
  CALENDAR_VIEWS,
  NOTIFICATION_CATEGORIES,
  EXECUTIVE_DASHBOARD_ISOLATION,
} from './types'

export {
  EXECUTIVE_TOKENS,
  executiveTokenCssVariables,
} from './design/executiveTokens'

export {
  createDemoExecutiveDashboardState,
  filterNotifications,
  assertExecutiveDashboardIsolation,
} from './state/executiveDashboardState'

export {
  ExecutiveDashboard,
  tryRenderExecutiveDashboard,
} from './components/ExecutiveDashboard'
export type { ExecutiveDashboardProps } from './components/ExecutiveDashboard'

export { ExecutiveDashboardPanels } from './dashboard'
export { NotificationCenter } from './notificationCenter'
export { DashboardFilters } from './filters'
export { ActionCards } from './actionCards'
export { ExecutiveWidgets } from './widgets'
export { CalendarPlaceholder } from './calendar'
export { ExecutiveMetrics } from './metrics'
export { ExecutiveSearch } from './search'

export const EXECUTIVE_DASHBOARD_ARCHITECTURE = {
  version: '4.6.0-executive-dashboard',
  featureId: 'ui.executive_dashboard' as const,
  presentationOnly: true,
  regions: [
    'metrics',
    'filters',
    'dashboard_panels',
    'widgets',
    'calendar_placeholder',
    'notification_center',
    'search',
    'action_cards',
  ] as const,
  ...ED_ISOLATION,
} as const
