/**
 * Phase 6 Stage 1 — Integration Foundation root.
 * Presentation architecture only. Not mounted in production routes.
 */

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import './integrationFoundation.css'
import { integrationTokenCssVariables, SHARED_ICONS } from '../design/sharedTokens'
import { isIntegrationFoundationEnabled } from '../integrationFoundationRegistry'
import { resolveLayoutChrome } from '../layout/layoutManager'
import {
  FeatureFlagManager,
} from '../registry/featureFlagManager'
import { ModuleRegistry } from '../registry/moduleRegistry'
import { NavigationRegistry } from '../registry/navigationRegistry'
import { RouteRegistry } from '../registry/routeRegistry'
import { createDemoIntegrationFoundationState } from '../state/integrationFoundationState'
import type {
  IntegrationFoundationUiState,
  IntegrationLocale,
  IntegrationModuleId,
  IntegrationNavItem,
  IntegrationTheme,
} from '../types'
import {
  ArchitectureOverviewScreen,
  DemoNavigationScreen,
  DependencyGraphScreen,
  DeveloperNavigationScreen,
  FeatureFlagToggleScreen,
  ModuleStatusScreen,
} from './DeveloperScreens'
import { ModulePreviewPage } from './ModulePreviewPage'

export interface IntegrationFoundationProps {
  /** Force-enable for tests / demos without registry. */
  enabled?: boolean
  locale?: IntegrationLocale
  theme?: IntegrationTheme
  initialState?: Partial<IntegrationFoundationUiState>
}

export function IntegrationFoundation({
  enabled,
  locale = 'ar',
  theme = 'light',
  initialState,
}: IntegrationFoundationProps) {
  const on = isIntegrationFoundationEnabled({ enabled })
  const [state, setState] = useState<IntegrationFoundationUiState>(() => {
    const demo = createDemoIntegrationFoundationState({
      locale: initialState?.locale ?? locale,
      theme: initialState?.theme ?? theme,
      enabled,
    })
    return { ...demo, ...initialState, featureEnabled: demo.featureEnabled }
  })

  const cssVars = useMemo(
    () => integrationTokenCssVariables(state.theme) as CSSProperties,
    [state.theme],
  )

  const chrome = resolveLayoutChrome(state.activeScreen)
  const statuses = FeatureFlagManager.listModuleStatuses(state.localFlagOverrides)
  const moduleIds = ModuleRegistry.ids()

  if (!on) return null

  const navigate = (item: IntegrationNavItem) => {
    setState((prev) => ({
      ...prev,
      activeRouteId: item.routeId,
      activeScreen: item.screenId,
      previewModuleId: item.moduleId ?? prev.previewModuleId,
    }))
  }

  const openModule = (moduleId: IntegrationModuleId) => {
    setState((prev) => ({
      ...prev,
      activeRouteId: 'dev.module_preview',
      activeScreen: 'module_preview',
      previewModuleId: moduleId,
    }))
  }

  return (
    <div
      className="rahhal-if"
      data-testid="integration-foundation"
      data-if="integration-foundation"
      data-theme={state.theme}
      data-locale={state.locale}
      data-screen={state.activeScreen}
      data-route={state.activeRouteId}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      style={cssVars}
    >
      <header className="rahhal-if-header" data-testid="if-header">
        <div>
          <p className="rahhal-if-brand">رحّال</p>
          <h1>
            {state.locale === 'en'
              ? 'Integration Foundation'
              : 'أساس التكامل'}
          </h1>
        </div>
        <button
          type="button"
          data-testid="if-theme-toggle"
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

      <div className="rahhal-if-shell" data-testid="if-layout">
        {chrome.showSidebar ? (
          <nav className="rahhal-if-nav" data-testid="if-sidebar">
            {NavigationRegistry.developer().map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  item.screenId === state.activeScreen ? 'is-active' : undefined
                }
                data-nav={item.routeId}
                onClick={() => navigate(item)}
              >
                {SHARED_ICONS.module}{' '}
                {state.locale === 'en' ? item.labelEn : item.labelAr}
              </button>
            ))}
          </nav>
        ) : null}

        <main className={chrome.pageTransitionClass} data-testid="if-main">
          {state.activeScreen === 'developer_nav' ? (
            <DeveloperNavigationScreen
              locale={state.locale}
              items={NavigationRegistry.developer()}
              activeId={`nav-${state.activeRouteId}`}
              onNavigate={navigate}
            />
          ) : null}

          {state.activeScreen === 'demo_nav' ? (
            <DemoNavigationScreen
              locale={state.locale}
              items={NavigationRegistry.demo()}
              onOpenModule={openModule}
            />
          ) : null}

          {state.activeScreen === 'module_preview' ? (
            <ModulePreviewPage
              locale={state.locale}
              theme={state.theme}
              moduleId={state.previewModuleId ?? moduleIds[0] ?? null}
              moduleIds={moduleIds}
              onSelect={openModule}
            />
          ) : null}

          {state.activeScreen === 'feature_flags' ? (
            <FeatureFlagToggleScreen
              locale={state.locale}
              statuses={statuses}
              onToggle={(featureId, next) =>
                setState((prev) => ({
                  ...prev,
                  localFlagOverrides: FeatureFlagManager.applyLocalFlagOverride(
                    prev.localFlagOverrides,
                    featureId,
                    next,
                  ),
                }))
              }
            />
          ) : null}

          {state.activeScreen === 'module_status' ? (
            <ModuleStatusScreen locale={state.locale} statuses={statuses} />
          ) : null}

          {state.activeScreen === 'dependency_graph' ? (
            <DependencyGraphScreen locale={state.locale} />
          ) : null}

          {state.activeScreen === 'architecture_overview' ? (
            <ArchitectureOverviewScreen
              locale={state.locale}
              routes={RouteRegistry.all()}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}

export function tryRenderIntegrationFoundation(
  props: IntegrationFoundationProps = {},
): ReactElement | null {
  if (!isIntegrationFoundationEnabled({ enabled: props.enabled })) return null
  return <IntegrationFoundation {...props} />
}
