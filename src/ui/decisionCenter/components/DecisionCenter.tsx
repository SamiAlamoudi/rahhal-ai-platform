/**
 * Phase 5 Stage 2 — AI Decision Center root.
 * Presentation only. Not mounted in production routes.
 */

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import './decisionCenter.css'
import { decisionTokenCssVariables } from '../design/decisionTokens'
import { isDecisionCenterEnabled } from '../decisionCenterRegistry'
import { createDemoDecisionCenterState } from '../state/decisionCenterState'
import type {
  DecisionCenterLocale,
  DecisionCenterTheme,
  DecisionCenterUiState,
  DecisionType,
} from '../types'
import { ComparisonCards } from './ComparisonCards'
import { ConfidenceMeter } from './ConfidenceMeter'
import { DecisionSummary } from './DecisionSummary'
import { DecisionTreeView } from './DecisionTreeView'
import { ScoreBars } from './ScoreBars'

export interface DecisionCenterProps {
  /** Force-enable for tests / demos without registry. */
  enabled?: boolean
  locale?: DecisionCenterLocale
  theme?: DecisionCenterTheme
  initialState?: Partial<DecisionCenterUiState>
}

export function DecisionCenter({
  enabled,
  locale = 'ar',
  theme = 'light',
  initialState,
}: DecisionCenterProps) {
  const on = isDecisionCenterEnabled({ enabled })
  const [state, setState] = useState<DecisionCenterUiState>(() => {
    const demo = createDemoDecisionCenterState({
      locale: initialState?.locale ?? locale,
      theme: initialState?.theme ?? theme,
      enabled,
      decisionType: initialState?.decisionType,
    })
    return { ...demo, ...initialState, featureEnabled: demo.featureEnabled }
  })

  const cssVars = useMemo(
    () => decisionTokenCssVariables(state.theme) as CSSProperties,
    [state.theme],
  )

  if (!on) return null

  return (
    <div
      className="rahhal-dc"
      data-testid="decision-center"
      data-dc="decision-center"
      data-theme={state.theme}
      data-locale={state.locale}
      data-decision-type={state.decisionType}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      style={cssVars}
    >
      <header className="rahhal-dc-header" data-testid="dc-header">
        <div>
          <p className="rahhal-dc-brand">رحّال</p>
          <h1>
            {state.locale === 'en' ? 'Decision Center' : 'مركز القرار'}
          </h1>
        </div>
        <button
          type="button"
          data-testid="dc-theme-toggle"
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

      <div className="rahhal-dc-layout">
        <DecisionSummary
          decisionType={state.decisionType}
          summary={state.summary}
          whyRecommended={state.whyRecommended}
          recommendationReason={state.recommendationReason}
          pros={state.pros}
          cons={state.cons}
          riskIndicators={state.riskIndicators}
          timelineImpact={state.timelineImpact}
          locale={state.locale}
          onTypeChange={(decisionType: DecisionType) =>
            setState((prev) => ({ ...prev, decisionType }))
          }
        />

        <div className="rahhal-dc-side">
          <ConfidenceMeter confidence={state.confidence} locale={state.locale} />
          <ScoreBars options={state.options} locale={state.locale} />
        </div>
      </div>

      <ComparisonCards
        options={state.options}
        comparison={state.comparison}
        locale={state.locale}
      />

      <div className="rahhal-dc-layout">
        <DecisionTreeView tree={state.tree} locale={state.locale} />
        <section data-testid="dc-alternatives" className="rahhal-dc-panel">
          <h2>{state.locale === 'en' ? 'Alternatives' : 'البدائل'}</h2>
          <ul>
            {state.options
              .filter((o) => o.tags.includes('alternative'))
              .map((o) => (
                <li key={o.id} data-testid="dc-alternative">
                  {o.title}
                </li>
              ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

export function tryRenderDecisionCenter(
  props: DecisionCenterProps = {},
): ReactElement | null {
  if (!isDecisionCenterEnabled({ enabled: props.enabled })) return null
  return <DecisionCenter {...props} />
}
