/**
 * Phase 4 Stage 1 — Premium Application Shell frame.
 * Renders only when `ui.application_shell` is enabled (or forced).
 * Not mounted in production main.tsx routes.
 */

import { useMemo, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { isApplicationShellEnabled } from '../applicationShellRegistry'
import { shellTokenCssVariables } from '../designSystem/tokens'
import { tShell } from '../localization/localizationState'
import { getShellModule } from '../modules/moduleRegistry'
import {
  createInitialShellState,
  setActiveShellModule,
  setShellBreakpoint,
  setShellDrawerOpen,
  setShellThemeMode,
} from '../state/shellState'
import { resolveShellThemeTokens, shellThemeCssVariables } from '../theme/themeTokens'
import type { ShellModuleId, ShellThemeMode, ShellUiState } from '../types'
import { BottomNavigation } from './BottomNavigation'
import { SideDrawer } from './SideDrawer'

export interface ApplicationShellProps {
  /** Force-enable for tests / demos without registry. */
  enabled?: boolean
  initialState?: Partial<{
    locale: 'ar' | 'en'
    themeMode: ShellThemeMode
    width: number
    isAuthenticated: boolean
  }>
  children?: ReactNode
}

export function ApplicationShell({
  enabled,
  initialState,
  children,
}: ApplicationShellProps) {
  const shellOn = isApplicationShellEnabled({ enabled })
  const [state, setState] = useState<ShellUiState>(() =>
    createInitialShellState({
      locale: initialState?.locale,
      themeMode: initialState?.themeMode,
      width: initialState?.width,
      isAuthenticated: initialState?.isAuthenticated,
      enabled,
    }),
  )

  const cssVars = useMemo(() => {
    const theme = resolveShellThemeTokens(state.theme.mode, state.theme.resolved === 'dark')
    return {
      ...shellTokenCssVariables(),
      ...shellThemeCssVariables(theme),
    } as CSSProperties
  }, [state.theme.mode, state.theme.resolved])

  if (!shellOn) return null

  const locale = state.localization.locale
  const dir = state.localization.direction
  const activeModule = getShellModule(state.navigation.activeModuleId)
  const showDrawerChrome = state.breakpoint === 'desktop' || state.breakpoint === 'tablet'

  const onSelect = (moduleId: ShellModuleId, path: string) => {
    setState((prev) => setActiveShellModule(prev, moduleId, path))
  }

  return (
    <div
      data-shell="application-shell"
      data-breakpoint={state.breakpoint}
      data-theme={state.theme.resolved}
      dir={dir}
      style={{
        ...cssVars,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--shell-color-bg)',
        color: 'var(--shell-color-text)',
        fontFamily: 'var(--shell-font-body)',
      }}
    >
      <header
        data-shell="top-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--shell-color-border)',
          background: 'var(--shell-color-surface)',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(state.breakpoint === 'phone' || state.breakpoint === 'foldable' || showDrawerChrome) && (
            <button
              type="button"
              data-shell="drawer-toggle"
              onClick={() => setState((p) => setShellDrawerOpen(p, !p.navigation.drawerOpen))}
            >
              ☰
            </button>
          )}
          <strong style={{ fontFamily: 'var(--shell-font-display)', fontSize: 18 }}>
            رحّال
          </strong>
        </div>
        <span data-shell="active-module-label">
          {activeModule ? tShell(locale, activeModule.titleKey) : ''}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            data-shell="theme-cycle"
            onClick={() => {
              const order: ShellThemeMode[] = ['light', 'dark', 'system']
              const next = order[(order.indexOf(state.theme.mode) + 1) % order.length]!
              setState((p) => setShellThemeMode(p, next, next === 'dark'))
            }}
          >
            {state.theme.mode}
          </button>
          <button
            type="button"
            data-shell="breakpoint-phone"
            onClick={() => setState((p) => setShellBreakpoint(p, 390))}
          >
            phone
          </button>
          <button
            type="button"
            data-shell="breakpoint-desktop"
            onClick={() => setState((p) => setShellBreakpoint(p, 1280))}
          >
            desktop
          </button>
        </div>
      </header>

      <SideDrawer
        locale={locale}
        open={state.navigation.drawerOpen}
        activeModuleId={state.navigation.activeModuleId}
        onSelect={onSelect}
        onClose={() => setState((p) => setShellDrawerOpen(p, false))}
      />

      <main
        data-shell="content"
        data-active-path={state.navigation.activePath}
        style={{ flex: 1, padding: 16 }}
      >
        {children ?? (
          <section data-shell="module-placeholder">
            <h1 style={{ fontFamily: 'var(--shell-font-display)', marginTop: 0 }}>
              {activeModule ? tShell(locale, activeModule.titleKey) : 'Shell'}
            </h1>
            <p style={{ color: 'var(--shell-color-text-muted)' }}>
              {locale === 'ar'
                ? 'هيكل التطبيق فقط — بدون حجز أو بحث أو ذكاء اصطناعي في هذه المرحلة.'
                : 'Application shell only — no booking, search, or AI in this stage.'}
            </p>
            <p data-shell="empty-state">{tShell(locale, 'shell.empty.generic')}</p>
          </section>
        )}
      </main>

      <BottomNavigation
        locale={locale}
        activeModuleId={state.navigation.activeModuleId}
        onSelect={onSelect}
        visible={state.navigation.bottomNavVisible}
      />
    </div>
  )
}

export function tryRenderApplicationShell(
  props: ApplicationShellProps,
): ReactElement | null {
  if (!isApplicationShellEnabled({ enabled: props.enabled })) return null
  return <ApplicationShell {...props} />
}
