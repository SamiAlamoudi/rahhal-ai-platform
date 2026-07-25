/**
 * Phase 5 Stage 1 — AI Journey Timeline root.
 * Presentation only. Not mounted in production routes.
 */

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import './journeyTimeline.css'
import { journeyTokenCssVariables } from '../design/journeyTokens'
import { isJourneyTimelineEnabled } from '../journeyTimelineRegistry'
import {
  createInitialJourneyTimelineState,
  eventsForLayout,
} from '../state/journeyTimelineState'
import type {
  JourneyLayout,
  JourneyTimelineLocale,
  JourneyTimelineTheme,
  JourneyTimelineUiState,
} from '../types'
import { JOURNEY_LAYOUTS } from '../types'
import { JourneyProgress } from './JourneyProgress'
import { TimelineBoard } from './TimelineBoard'

export interface JourneyTimelineProps {
  /** Force-enable for tests / demos without registry. */
  enabled?: boolean
  locale?: JourneyTimelineLocale
  theme?: JourneyTimelineTheme
  initialState?: Partial<JourneyTimelineUiState>
}

export function JourneyTimeline({
  enabled,
  locale = 'ar',
  theme = 'light',
  initialState,
}: JourneyTimelineProps) {
  const on = isJourneyTimelineEnabled({ enabled })
  const [state, setState] = useState<JourneyTimelineUiState>(() => {
    const demo = createInitialJourneyTimelineState({
      locale: initialState?.locale ?? locale,
      theme: initialState?.theme ?? theme,
      enabled,
      layout: initialState?.layout,
    })
    return { ...demo, ...initialState, featureEnabled: demo.featureEnabled }
  })

  const cssVars = useMemo(
    () => journeyTokenCssVariables(state.theme) as CSSProperties,
    [state.theme],
  )

  const visibleEvents = useMemo(
    () => eventsForLayout(state.events, state.layout),
    [state.events, state.layout],
  )

  if (!on) return null

  return (
    <div
      className="rahhal-jt"
      data-testid="journey-timeline"
      data-jt="journey-timeline"
      data-theme={state.theme}
      data-locale={state.locale}
      data-layout={state.layout}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      style={cssVars}
    >
      <header className="rahhal-jt-header" data-testid="jt-header">
        <div>
          <p className="rahhal-jt-brand">رحّال</p>
          <h1>
            {state.locale === 'en' ? 'Journey Timeline' : 'الجدول الزمني للرحلة'}
          </h1>
        </div>
        <button
          type="button"
          data-testid="jt-theme-toggle"
          onClick={() =>
            setState((prev) => ({
              ...prev,
              theme: prev.theme === 'light' ? 'dark' : 'light',
            }))
          }
        >
          {state.theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </header>

      <nav className="rahhal-jt-layouts" data-testid="jt-layouts" aria-label="layouts">
        {JOURNEY_LAYOUTS.map((layout) => (
          <button
            key={layout}
            type="button"
            data-layout={layout}
            className={state.layout === layout ? 'is-active' : undefined}
            aria-pressed={state.layout === layout}
            onClick={() =>
              setState((prev) => ({ ...prev, layout: layout as JourneyLayout }))
            }
          >
            {layout}
          </button>
        ))}
      </nav>

      <JourneyProgress progress={state.progress} locale={state.locale} />
      <TimelineBoard
        events={visibleEvents}
        layout={state.layout}
        locale={state.locale}
      />
    </div>
  )
}

export function tryRenderJourneyTimeline(
  props: JourneyTimelineProps = {},
): ReactElement | null {
  if (!isJourneyTimelineEnabled({ enabled: props.enabled })) return null
  return <JourneyTimeline {...props} />
}
