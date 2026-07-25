/**
 * Phase 4 Stage 6 — Executive Dashboard + Notification Center root.
 * Presentation only. Not mounted in production routes.
 */

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import './executiveDashboard.css'
import { ActionCards } from '../actionCards'
import { CalendarPlaceholder } from '../calendar'
import { ExecutiveDashboardPanels } from '../dashboard'
import { executiveTokenCssVariables } from '../design/executiveTokens'
import { isExecutiveDashboardEnabled } from '../executiveDashboardRegistry'
import { DashboardFilters } from '../filters'
import { ExecutiveMetrics } from '../metrics'
import { NotificationCenter } from '../notificationCenter'
import { ExecutiveSearch } from '../search'
import { createDemoExecutiveDashboardState } from '../state/executiveDashboardState'
import type {
  ActionCardId,
  ExecutiveDashboardUiState,
  ExecutiveLocale,
  ExecutiveTheme,
} from '../types'
import { ExecutiveWidgets } from '../widgets'

export interface ExecutiveDashboardProps {
  /** Force-enable for tests / demos without registry. */
  enabled?: boolean
  locale?: ExecutiveLocale
  theme?: ExecutiveTheme
  initialState?: Partial<ExecutiveDashboardUiState>
  onAction?: (id: ActionCardId) => void
}

export function ExecutiveDashboard({
  enabled,
  locale = 'ar',
  theme = 'light',
  initialState,
  onAction,
}: ExecutiveDashboardProps) {
  const on = isExecutiveDashboardEnabled({ enabled })
  const [state, setState] = useState<ExecutiveDashboardUiState>(() => {
    const demo = createDemoExecutiveDashboardState({
      locale: initialState?.locale ?? locale,
      theme: initialState?.theme ?? theme,
      enabled,
      notifications: initialState?.notifications,
    })
    return { ...demo, ...initialState, featureEnabled: demo.featureEnabled }
  })

  const cssVars = useMemo(
    () => executiveTokenCssVariables(state.theme) as CSSProperties,
    [state.theme],
  )

  if (!on) return null

  return (
    <div
      className="rahhal-ed"
      data-testid="executive-dashboard"
      data-ed="executive-dashboard"
      data-theme={state.theme}
      data-locale={state.locale}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      style={cssVars}
    >
      <header className="rahhal-ed-header" data-testid="ed-header">
        <div>
          <p className="rahhal-ed-brand">رحّال</p>
          <h1>
            {state.locale === 'en' ? 'Executive Dashboard' : 'لوحة التنفيذيين'}
          </h1>
        </div>
        <button
          type="button"
          data-testid="ed-theme-toggle"
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

      <ExecutiveSearch
        search={state.search}
        locale={state.locale}
        onChange={(search) => setState((prev) => ({ ...prev, search }))}
      />

      <DashboardFilters
        active={state.activeFilter}
        locale={state.locale}
        onChange={(activeFilter) => setState((prev) => ({ ...prev, activeFilter }))}
      />

      <ExecutiveMetrics metrics={state.metrics} locale={state.locale} />
      <ActionCards locale={state.locale} onAction={onAction} />

      <div className="rahhal-ed-layout">
        <main className="rahhal-ed-main" data-testid="ed-main">
          <ExecutiveDashboardPanels
            locale={state.locale}
            upcomingTrips={state.upcomingTrips}
            todaySchedule={state.todaySchedule}
            boardMeetings={state.boardMeetings}
            travelerStatuses={state.travelerStatuses}
            pendingActions={state.pendingActions}
            recentActivity={state.recentActivity}
            travelProgressPercent={state.travelProgressPercent}
          />
          <ExecutiveWidgets
            locale={state.locale}
            progressPercent={state.travelProgressPercent}
          />
          <CalendarPlaceholder
            view={state.calendarView}
            locale={state.locale}
            onViewChange={(calendarView) =>
              setState((prev) => ({ ...prev, calendarView }))
            }
          />
        </main>

        <NotificationCenter
          notifications={state.notifications}
          locale={state.locale}
          onMarkRead={(id) =>
            setState((prev) => ({
              ...prev,
              notifications: prev.notifications.map((n) =>
                n.id === id ? { ...n, readState: 'read' } : n,
              ),
            }))
          }
        />
      </div>
    </div>
  )
}

export function tryRenderExecutiveDashboard(
  props: ExecutiveDashboardProps = {},
): ReactElement | null {
  if (!isExecutiveDashboardEnabled({ enabled: props.enabled })) return null
  return <ExecutiveDashboard {...props} />
}
