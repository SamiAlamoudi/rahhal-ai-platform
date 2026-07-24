/**
 * Phase 4 Stage 1 — Side drawer navigation (presentation architecture).
 */

import { listDrawerModules } from '../modules/moduleRegistry'
import { tShell } from '../localization/localizationState'
import type { ShellLocale, ShellModuleId } from '../types'

export interface SideDrawerProps {
  locale: ShellLocale
  open: boolean
  activeModuleId: ShellModuleId
  onSelect: (moduleId: ShellModuleId, path: string) => void
  onClose: () => void
}

export function SideDrawer({
  locale,
  open,
  activeModuleId,
  onSelect,
  onClose,
}: SideDrawerProps) {
  if (!open) return null
  const items = listDrawerModules()
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <aside
      data-shell="side-drawer"
      dir={dir}
      aria-label={tShell(locale, 'shell.nav.drawer')}
      style={{
        position: 'fixed',
        insetBlock: 0,
        [dir === 'rtl' ? 'right' : 'left']: 0,
        width: 280,
        zIndex: 40,
        background: 'var(--shell-color-surface, #fff)',
        borderInlineEnd: '1px solid var(--shell-color-border, #E2E8F0)',
        padding: 16,
        boxShadow: 'var(--shell-elevation-md, 0 4px 12px rgba(0,0,0,0.08))',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <strong style={{ fontFamily: 'var(--shell-font-display)' }}>
          {tShell(locale, 'shell.nav.drawer')}
        </strong>
        <button type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {items.map((item) => {
          const active = item.id === activeModuleId
          return (
            <li key={item.id}>
              <button
                type="button"
                data-module={item.id}
                data-active={active ? 'true' : 'false'}
                onClick={() => onSelect(item.id, item.path)}
                style={{
                  width: '100%',
                  textAlign: 'start',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 12px',
                  background: active ? 'var(--shell-color-primary, #0F3D3E)' : 'transparent',
                  color: active ? '#fff' : 'var(--shell-color-text, #14212B)',
                  fontFamily: 'var(--shell-font-body)',
                  cursor: 'pointer',
                }}
              >
                {tShell(locale, item.titleKey)}
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
