/**
 * Phase 5 Stage 2 — AI Decision Center barrel.
 *
 * Isolated presentation package. Not wired into production main.tsx,
 * AI, Runtime, Booking, Maps, Weather, or Notifications.
 * Gated by `ui.decision_center` (default OFF).
 */

import { DECISION_CENTER_ISOLATION as DC_ISOLATION } from './types'

export {
  DECISION_CENTER_FEATURE_ID,
  isDecisionCenterEnabled,
  DecisionCenterRegistry,
} from './decisionCenterRegistry'

export type {
  DecisionCenterLocale,
  DecisionCenterTheme,
  DecisionType,
  DecisionStateTag,
  DecisionOptionModel,
  DecisionComparisonModel,
  DecisionTreeNode,
  DecisionCenterUiState,
} from './types'

export {
  DECISION_TYPES,
  DECISION_STATE_TAGS,
  DECISION_CENTER_ISOLATION,
} from './types'

export {
  DECISION_TOKENS,
  decisionTokenCssVariables,
} from './design/decisionTokens'

export {
  createDemoDecisionCenterState,
  assertDecisionCenterIsolation,
} from './state/decisionCenterState'

export {
  DecisionCenter,
  tryRenderDecisionCenter,
} from './components/DecisionCenter'
export type { DecisionCenterProps } from './components/DecisionCenter'
export { DecisionSummary } from './components/DecisionSummary'
export { ComparisonCards } from './components/ComparisonCards'
export { ConfidenceMeter } from './components/ConfidenceMeter'
export { ScoreBars } from './components/ScoreBars'
export { DecisionTreeView } from './components/DecisionTreeView'

export const DECISION_CENTER_ARCHITECTURE = {
  version: '5.2.0-decision-center',
  featureId: 'ui.decision_center' as const,
  presentationOnly: true,
  regions: [
    'decision_summary',
    'comparison_cards',
    'confidence_meter',
    'score_bars',
    'decision_tree',
    'alternatives',
    'cost_chart_placeholder',
  ] as const,
  ...DC_ISOLATION,
} as const
