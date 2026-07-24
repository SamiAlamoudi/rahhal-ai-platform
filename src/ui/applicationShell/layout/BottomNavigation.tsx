/**
 * Phase 4 Stage 1 — Bottom navigation (presentation architecture).
 */

import { listBottomNavModules } from '../modules/moduleRegistry'
import { tShell } from '../localization/localizationState'
import type { ShellLocale, ShellModuleId } from '../types'

export interface BottomNavigationProps {
  locale: ShellLocale
  activeModuleId: ShellModuleId
  onSelect: (moduleId: ShellModuleId, path: string) => void
  visible?: boolean
}

export function BottomNavigation({
  locale,
  activeModuleId,
  onSelect,
  visible = true,
}: BottomNavigationProps) {
  if (!visible) return null
  const items = listBottomNavModules()
  return (
    <nav
      data-shell="bottom-navigation"
      aria-label={tShell(locale, 'shell.nav.bottom')}
      style={{
        display: 'flex',
        gap: 8,
        padding: 12,
        borderTop: '1px solid var(--shell-color-border, #E2E8F0)',
        background: 'var(--shell-color-surface, #fff)',
      }}
    >
      {items.map((item) => {
        const active = item.id === activeModuleId
        return (
          <button
            key={item.id}
            type="button"
            data-module={item.id}
            data-active={active ? 'true' : 'false'}
            onClick={() => onSelect(item.id, item.path)}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 10,
              padding: '8px 6px',
              background: active ? 'var(--shell-color-primary, #0F3D3E)' : 'transparent',
              color: active ? '#fff' : 'var(--shell-color-text, #14212B)',
              fontFamily: 'var(--shell-font-body)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {tShell(locale, item.titleKey)}
          </button>
        )
      })}
    </nav>
  )
}
