/**
 * Phase 5 Stage 7 — Operations Center root.
 * Presentation only. Not mounted in production routes.
 */

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import './operationsCenter.css'
import { operationsCenterTokenCssVariables } from '../design/operationsCenterTokens'
import { isOperationsCenterEnabled } from '../operationsCenterRegistry'
import { createDemoOperationsCenterState } from '../state/operationsCenterState'
import type {
  OperationsCenterLocale,
  OperationsCenterTheme,
  OperationsCenterUiState,
  OperationsFilterId,
} from '../types'
import { OperationsOverview } from './OperationsOverview'
import { OperationsToolbar } from './OperationsToolbar'
import { ProvidersAndWorkload } from './ProvidersAndWorkload'
import { QueuesAndIncidents } from './QueuesAndIncidents'

export interface OperationsCenterProps {
  /** Force-enable for tests / demos without registry. */
  enabled?: boolean
  locale?: OperationsCenterLocale
  theme?: OperationsCenterTheme
  initialState?: Partial<OperationsCenterUiState>
}

export function OperationsCenter({
  enabled,
  locale = 'ar',
  theme = 'light',
  initialState,
}: OperationsCenterProps) {
  const on = isOperationsCenterEnabled({ enabled })
  const [state, setState] = useState<OperationsCenterUiState>(() => {
    const demo = createDemoOperationsCenterState({
      locale: initialState?.locale ?? locale,
      theme: initialState?.theme ?? theme,
      enabled,
      activeFilter: initialState?.activeFilter,
    })
    return { ...demo, ...initialState, featureEnabled: demo.featureEnabled }
  })

  const cssVars = useMemo(
    () => operationsCenterTokenCssVariables(state.theme) as CSSProperties,
    [state.theme],
  )

  if (!on) return null

  return (
    <div
      className="rahhal-oc"
      data-testid="operations-center"
      data-oc="operations-center"
      data-theme={state.theme}
      data-locale={state.locale}
      data-filter={state.activeFilter}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      style={cssVars}
    >
      <header className="rahhal-oc-header" data-testid="oc-header">
        <div>
          <p className="rahhal-oc-brand">رحّال</p>
          <h1>
            {state.locale === 'en'
              ? 'Operations Center'
              : 'مركز العمليات'}
          </h1>
        </div>
        <button
          type="button"
          data-testid="oc-theme-toggle"
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

      <OperationsToolbar
        activeFilter={state.activeFilter}
        searchQuery={state.searchQuery}
        locale={state.locale}
        onFilterChange={(activeFilter: OperationsFilterId) =>
          setState((prev) => ({ ...prev, activeFilter }))
        }
        onSearchChange={(searchQuery: string) =>
          setState((prev) => ({ ...prev, searchQuery }))
        }
      />

      <OperationsOverview
        overview={state.overview}
        metrics={state.metrics}
        activeTrips={state.activeTrips}
        upcomingTrips={state.upcomingTrips}
        delayedTrips={state.delayedTrips}
        locale={state.locale}
      />

      <QueuesAndIncidents
        travelerRequests={state.travelerRequests}
        supportQueue={state.supportQueue}
        incidents={state.incidents}
        emergencyItems={state.emergencyItems}
        approvalQueue={state.approvalQueue}
        bookingQueue={state.bookingQueue}
        visaQueue={state.visaQueue}
        notificationsQueue={state.notificationsQueue}
        locale={state.locale}
      />

      <ProvidersAndWorkload
        providers={state.providers}
        slaMetrics={state.slaMetrics}
        agentWorkload={state.agentWorkload}
        activityFeed={state.activityFeed}
        auditTimeline={state.auditTimeline}
        calendarDays={state.calendarDays}
        mapPlaceholder={state.mapPlaceholder}
        chartPlaceholder={state.chartPlaceholder}
        locale={state.locale}
      />
    </div>
  )
}

export function tryRenderOperationsCenter(
  props: OperationsCenterProps = {},
): ReactElement | null {
  if (!isOperationsCenterEnabled({ enabled: props.enabled })) return null
  return <OperationsCenter {...props} />
}
