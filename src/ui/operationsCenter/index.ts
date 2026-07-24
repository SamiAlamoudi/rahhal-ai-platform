/**
 * Phase 5 Stage 7 — Operations Center barrel.
 *
 * Isolated presentation package. Not wired into production main.tsx,
 * AI, Runtime, Realtime, Database, Firebase, Notifications, Booking APIs,
 * Maps, Payments, or Authentication. Gated by `ui.operations_center` (default OFF).
 */

import { OPERATIONS_CENTER_ISOLATION as OC_ISOLATION } from './types'

export {
  OPERATIONS_CENTER_FEATURE_ID,
  isOperationsCenterEnabled,
  OperationsCenterRegistry,
} from './operationsCenterRegistry'

export type {
  OperationsCenterLocale,
  OperationsCenterTheme,
  OperationsFilterId,
  OperationsPriority,
  OperationsRisk,
  OperationsMetricCard,
  OperationsTripCard,
  OperationsQueueCard,
  OperationsIncidentCard,
  OperationsTravelerCard,
  OperationsProviderCard,
  OperationsTimelineItem,
  OperationsActivityItem,
  OperationsSlaMetric,
  OperationsAgentWorkload,
  OperationsCenterUiState,
} from './types'

export {
  OPERATIONS_FILTERS,
  OPERATIONS_CENTER_ISOLATION,
} from './types'

export {
  OPERATIONS_CENTER_TOKENS,
  operationsCenterTokenCssVariables,
} from './design/operationsCenterTokens'

export {
  createDemoOperationsCenterState,
  assertOperationsCenterIsolation,
} from './state/operationsCenterState'

export {
  OperationsCenter,
  tryRenderOperationsCenter,
} from './components/OperationsCenter'
export type { OperationsCenterProps } from './components/OperationsCenter'
export { OperationsToolbar } from './components/OperationsToolbar'
export { OperationsOverview } from './components/OperationsOverview'
export { QueuesAndIncidents } from './components/QueuesAndIncidents'
export { ProvidersAndWorkload } from './components/ProvidersAndWorkload'

export const OPERATIONS_CENTER_ARCHITECTURE = {
  version: '5.7.0-operations-center',
  featureId: 'ui.operations_center' as const,
  presentationOnly: true,
  regions: [
    'overview',
    'trips',
    'queues',
    'incidents',
    'emergency',
    'providers',
    'sla',
    'workload',
    'activity',
    'audit',
    'search',
    'filters',
    'priority_risk',
    'calendar',
    'map_placeholder',
    'charts_placeholder',
  ] as const,
  ...OC_ISOLATION,
} as const
