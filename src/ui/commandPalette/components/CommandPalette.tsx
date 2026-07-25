/**
 * Phase 4 Stage 8 — Universal Search & Command Palette root.
 * Presentation overlay only. Navigation labels — no production wiring.
 */

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import './commandPalette.css'
import { isCommandPaletteEnabled } from '../commandPaletteRegistry'
import { paletteTokenCssVariables } from '../design/paletteTokens'
import {
  createInitialCommandPaletteState,
  filterPaletteItems,
  resolveEmptyState,
} from '../state/commandPaletteState'
import type {
  CommandPaletteLocale,
  CommandPaletteTheme,
  CommandPaletteUiState,
  PaletteItem,
  ResultLayout,
} from '../types'
import { RESULT_LAYOUTS } from '../types'
import { PaletteEmpty } from './PaletteEmpty'
import { PaletteFilters } from './PaletteFilters'
import { PaletteResults } from './PaletteResults'

export interface CommandPaletteProps {
  /** Force-enable for tests / demos without registry. */
  enabled?: boolean
  locale?: CommandPaletteLocale
  theme?: CommandPaletteTheme
  initialState?: Partial<CommandPaletteUiState>
  onSelect?: (item: PaletteItem) => void
}

export function CommandPalette({
  enabled,
  locale = 'ar',
  theme = 'light',
  initialState,
  onSelect,
}: CommandPaletteProps) {
  const on = isCommandPaletteEnabled({ enabled })
  const [state, setState] = useState<CommandPaletteUiState>(() => {
    const demo = createInitialCommandPaletteState({
      locale: initialState?.locale ?? locale,
      theme: initialState?.theme ?? theme,
      enabled,
      open: initialState?.open,
    })
    return { ...demo, ...initialState, featureEnabled: demo.featureEnabled }
  })

  const cssVars = useMemo(
    () => paletteTokenCssVariables(state.theme) as CSSProperties,
    [state.theme],
  )

  const visible = useMemo(
    () => filterPaletteItems(state.items, state.query, state.activeFilter),
    [state.items, state.query, state.activeFilter],
  )

  const emptyKind = resolveEmptyState(state.query, visible.length)

  if (!on || !state.open) return null

  return (
    <div
      className="rahhal-cp"
      data-testid="command-palette"
      data-cp="command-palette"
      data-theme={state.theme}
      data-locale={state.locale}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      style={cssVars}
    >
      <div
        className="rahhal-cp-scrim"
        data-testid="cp-scrim"
        onClick={() => setState((prev) => ({ ...prev, open: false }))}
      />

      <div
        className="rahhal-cp-panel"
        role="dialog"
        aria-modal="true"
        aria-label={
          state.locale === 'en'
            ? 'Universal search and command palette'
            : 'البحث العام ولوحة الأوامر'
        }
      >
        <header className="rahhal-cp-header">
          <p className="rahhal-cp-brand">رحّال</p>
          <div className="rahhal-cp-shortcuts" data-testid="cp-shortcuts">
            <kbd data-testid="cp-shortcut-meta-k">⌘K</kbd>
            <kbd data-testid="cp-shortcut-ctrl-k">Ctrl+K</kbd>
            <span>
              {state.locale === 'en'
                ? 'Shortcuts placeholder'
                : 'اختصارات — واجهة'}
            </span>
          </div>
          <button
            type="button"
            data-testid="cp-theme-toggle"
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

        <label className="rahhal-cp-input-wrap">
          <span className="rahhal-cp-sr-only">
            {state.locale === 'en' ? 'Global search' : 'بحث عام'}
          </span>
          <input
            type="search"
            data-testid="cp-search-input"
            autoFocus
            value={state.query}
            placeholder={
              state.locale === 'en'
                ? 'Search trips, travelers, flights…'
                : 'ابحث عن رحلات، مسافرين، طيران…'
            }
            onChange={(e) =>
              setState((prev) => ({ ...prev, query: e.target.value }))
            }
          />
        </label>

        <PaletteFilters
          active={state.activeFilter}
          locale={state.locale}
          onChange={(activeFilter) =>
            setState((prev) => ({ ...prev, activeFilter }))
          }
        />

        <div className="rahhal-cp-layouts" data-testid="cp-layouts">
          {RESULT_LAYOUTS.map((layout) => (
            <button
              key={layout}
              type="button"
              data-layout={layout}
              className={state.layout === layout ? 'is-active' : undefined}
              aria-pressed={state.layout === layout}
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  layout: layout as ResultLayout,
                }))
              }
            >
              {layout}
            </button>
          ))}
        </div>

        <div className="rahhal-cp-quick" data-testid="cp-quick-actions">
          <span>
            {state.locale === 'en' ? 'Quick actions' : 'إجراءات سريعة'}
          </span>
          <span>
            {state.locale === 'en'
              ? 'Navigation shortcuts (labels only)'
              : 'اختصارات تنقل (تسميات فقط)'}
          </span>
        </div>

        {visible.length === 0 ? (
          <PaletteEmpty
            kind={emptyKind}
            locale={state.locale}
            recentQueries={state.recentQueries}
          />
        ) : (
          <PaletteResults
            items={visible}
            layout={state.layout}
            query={state.query}
            locale={state.locale}
            onSelect={onSelect}
          />
        )}
      </div>
    </div>
  )
}

export function tryRenderCommandPalette(
  props: CommandPaletteProps = {},
): ReactElement | null {
  if (!isCommandPaletteEnabled({ enabled: props.enabled })) return null
  return <CommandPalette {...props} />
}
