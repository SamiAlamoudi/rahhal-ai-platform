/**
 * Phase 5 Stage 3 — AI Insights Center barrel.
 *
 * Isolated presentation package. Not wired into production main.tsx,
 * AI, Runtime, Booking, Maps, Weather, Notifications, or analytics engines.
 * Gated by `ui.insights_center` (default OFF).
 */

import { INSIGHTS_CENTER_ISOLATION as IC_ISOLATION } from './types'

export {
  INSIGHTS_CENTER_FEATURE_ID,
  isInsightsCenterEnabled,
  InsightsCenterRegistry,
} from './insightsCenterRegistry'

export type {
  InsightsCenterLocale,
  InsightsCenterTheme,
  InsightsFilterId,
  InsightsStatCard,
  InsightsBreakdownItem,
  InsightsPlaceItem,
  InsightsTripCountModel,
  InsightsAchievementBadge,
  InsightsTimelinePoint,
  InsightsCenterUiState,
} from './types'

export {
  INSIGHTS_FILTERS,
  INSIGHTS_CENTER_ISOLATION,
} from './types'

export {
  INSIGHTS_TOKENS,
  insightsTokenCssVariables,
} from './design/insightsTokens'

export {
  createDemoInsightsCenterState,
  assertInsightsCenterIsolation,
} from './state/insightsCenterState'

export {
  InsightsCenter,
  tryRenderInsightsCenter,
} from './components/InsightsCenter'
export type { InsightsCenterProps } from './components/InsightsCenter'
export { InsightsFilters } from './components/InsightsFilters'
export { StatisticsGrid } from './components/StatisticsGrid'
export { BudgetPanel } from './components/BudgetPanel'
export { PlacesPanel } from './components/PlacesPanel'
export { HealthAndPlaceholders } from './components/HealthAndPlaceholders'

export const INSIGHTS_CENTER_ARCHITECTURE = {
  version: '5.3.0-insights-center',
  featureId: 'ui.insights_center' as const,
  presentationOnly: true,
  regions: [
    'overview',
    'statistics',
    'budget',
    'places',
    'health_score',
    'timeline_summary',
    'badges',
    'placeholders',
    'filters',
  ] as const,
  ...IC_ISOLATION,
} as const
