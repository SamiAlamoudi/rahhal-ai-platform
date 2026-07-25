/**
 * Phase 5 Stage 3 — AI Insights Center root.
 * Presentation only. Not mounted in production routes.
 */

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import './insightsCenter.css'
import { insightsTokenCssVariables } from '../design/insightsTokens'
import { isInsightsCenterEnabled } from '../insightsCenterRegistry'
import { createDemoInsightsCenterState } from '../state/insightsCenterState'
import type {
  InsightsCenterLocale,
  InsightsCenterTheme,
  InsightsCenterUiState,
  InsightsFilterId,
} from '../types'
import { BudgetPanel } from './BudgetPanel'
import { HealthAndPlaceholders } from './HealthAndPlaceholders'
import { InsightsFilters } from './InsightsFilters'
import { PlacesPanel } from './PlacesPanel'
import { StatisticsGrid } from './StatisticsGrid'

export interface InsightsCenterProps {
  /** Force-enable for tests / demos without registry. */
  enabled?: boolean
  locale?: InsightsCenterLocale
  theme?: InsightsCenterTheme
  initialState?: Partial<InsightsCenterUiState>
}

export function InsightsCenter({
  enabled,
  locale = 'ar',
  theme = 'light',
  initialState,
}: InsightsCenterProps) {
  const on = isInsightsCenterEnabled({ enabled })
  const [state, setState] = useState<InsightsCenterUiState>(() => {
    const demo = createDemoInsightsCenterState({
      locale: initialState?.locale ?? locale,
      theme: initialState?.theme ?? theme,
      enabled,
      activeFilter: initialState?.activeFilter,
    })
    return { ...demo, ...initialState, featureEnabled: demo.featureEnabled }
  })

  const cssVars = useMemo(
    () => insightsTokenCssVariables(state.theme) as CSSProperties,
    [state.theme],
  )

  if (!on) return null

  return (
    <div
      className="rahhal-ic"
      data-testid="insights-center"
      data-ic="insights-center"
      data-theme={state.theme}
      data-locale={state.locale}
      data-filter={state.activeFilter}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      style={cssVars}
    >
      <header className="rahhal-ic-header" data-testid="ic-header">
        <div>
          <p className="rahhal-ic-brand">رحّال</p>
          <h1>
            {state.locale === 'en' ? 'Insights Center' : 'مركز الرؤى'}
          </h1>
        </div>
        <button
          type="button"
          data-testid="ic-theme-toggle"
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

      <InsightsFilters
        active={state.activeFilter}
        locale={state.locale}
        onChange={(activeFilter: InsightsFilterId) =>
          setState((prev) => ({ ...prev, activeFilter }))
        }
      />

      <section data-testid="ic-overview" className="rahhal-ic-panel">
        <h2>
          {state.locale === 'en' ? 'Travel overview' : 'نظرة عامة على السفر'}
        </h2>
        <p>{state.overview}</p>
      </section>

      <StatisticsGrid statistics={state.statistics} locale={state.locale} />

      <div className="rahhal-ic-layout">
        <BudgetPanel
          budgetTotalLabel={state.budgetTotalLabel}
          savingsLabel={state.savingsLabel}
          costBreakdown={state.costBreakdown}
          locale={state.locale}
        />
        <section className="rahhal-ic-panel" data-testid="ic-comparison-widget">
          <h2>
            {state.locale === 'en' ? 'Comparison widget' : 'أداة المقارنة'}
          </h2>
          <p>
            {state.locale === 'en'
              ? 'Business vs personal spend — presentation only.'
              : 'إنفاق العمل مقابل الشخصي — واجهة فقط.'}
          </p>
          <div className="rahhal-ic-compare">
            <span data-testid="ic-score-card">Business 68%</span>
            <span data-testid="ic-score-card">Personal 32%</span>
          </div>
        </section>
      </div>

      <PlacesPanel
        countries={state.visitedCountries}
        cities={state.visitedCities}
        airlines={state.favoriteAirlines}
        hotels={state.favoriteHotels}
        locale={state.locale}
      />

      <StatisticsGrid
        statistics={state.journeyActivity}
        locale={state.locale}
        testId="ic-journey-activity"
      />

      <HealthAndPlaceholders
        travelHealthScore={state.travelHealthScore}
        tripFrequencyLabel={state.tripFrequencyLabel}
        tripCounts={state.tripCounts}
        carbonFootprintPlaceholder={state.carbonFootprintPlaceholder}
        passportStatusPlaceholder={state.passportStatusPlaceholder}
        visaStatusPlaceholder={state.visaStatusPlaceholder}
        loyaltySummaryPlaceholder={state.loyaltySummaryPlaceholder}
        timelineSummary={state.timelineSummary}
        badges={state.badges}
        locale={state.locale}
      />
    </div>
  )
}

export function tryRenderInsightsCenter(
  props: InsightsCenterProps = {},
): ReactElement | null {
  if (!isInsightsCenterEnabled({ enabled: props.enabled })) return null
  return <InsightsCenter {...props} />
}
