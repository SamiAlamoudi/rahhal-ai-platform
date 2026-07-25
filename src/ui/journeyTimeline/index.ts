/**
 * Phase 5 Stage 1 — AI Journey Timeline barrel.
 *
 * Isolated presentation package. Not wired into production main.tsx,
 * AI, Runtime Coordinator, Booking/Maps/Weather APIs.
 * Gated by `ui.journey_timeline` (default OFF).
 */

import { JOURNEY_TIMELINE_ISOLATION as JT_ISOLATION } from './types'

export {
  JOURNEY_TIMELINE_FEATURE_ID,
  isJourneyTimelineEnabled,
  JourneyTimelineRegistry,
} from './journeyTimelineRegistry'

export type {
  JourneyTimelineLocale,
  JourneyTimelineTheme,
  JourneyStepId,
  JourneyEventStatus,
  JourneyEventKind,
  JourneyLayout,
  JourneyEventCard,
  JourneyProgressModel,
  JourneyTimelineUiState,
} from './types'

export {
  JOURNEY_STEPS,
  JOURNEY_EVENT_STATUSES,
  JOURNEY_EVENT_KINDS,
  JOURNEY_LAYOUTS,
  JOURNEY_TIMELINE_ISOLATION,
} from './types'

export {
  JOURNEY_TOKENS,
  journeyTokenCssVariables,
} from './design/journeyTokens'

export {
  createDemoJourneyEvents,
  createInitialJourneyTimelineState,
  eventsForLayout,
  stepOrderIndex,
  assertJourneyTimelineIsolation,
} from './state/journeyTimelineState'

export {
  JourneyTimeline,
  tryRenderJourneyTimeline,
} from './components/JourneyTimeline'
export type { JourneyTimelineProps } from './components/JourneyTimeline'
export { JourneyProgress } from './components/JourneyProgress'
export { EventCard } from './components/EventCard'
export { TimelineBoard } from './components/TimelineBoard'

export const JOURNEY_TIMELINE_ARCHITECTURE = {
  version: '5.1.0-journey-timeline',
  featureId: 'ui.journey_timeline' as const,
  presentationOnly: true,
  regions: [
    'progress',
    'step_rail',
    'event_cards',
    'layout_switcher',
  ] as const,
  ...JT_ISOLATION,
} as const
