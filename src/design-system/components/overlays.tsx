/**
 * Rahhal Design System — overlay patterns (presentational shells).
 */

import type { ReactNode } from 'react'
import { IconClose } from '../icons/OutlinedIcons'
import { DsButton, DsText } from './primitives'

export function DsBottomSheet({
  title,
  children,
  open = true,
}: {
  title: string
  children: ReactNode
  open?: boolean
}) {
  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        marginTop: 'auto',
        background: 'var(--ds-surface)',
        borderRadius: 'var(--ds-radius-xl) var(--ds-radius-xl) 0 0',
        borderTop: 'var(--ds-border-width) solid var(--ds-border)',
        boxShadow: 'var(--ds-shadow-lg)',
        padding: '12px 20px calc(20px + var(--ds-safe-bottom))',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 40,
          height: 4,
          borderRadius: 99,
          background: 'var(--ds-border-strong)',
          margin: '0 auto 14px',
        }}
      />
      <DsText as="h2" variant="title" style={{ marginBottom: 12 }}>
        {title}
      </DsText>
      {children}
    </div>
  )
}

export function DsDialog({
  title,
  body,
  primaryLabel = 'Continue',
  secondaryLabel = 'Not now',
}: {
  title: string
  body: string
  primaryLabel?: string
  secondaryLabel?: string
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ds-dialog-title"
      style={{
        margin: 'auto',
        width: 'min(100%, 320px)',
        padding: 22,
        borderRadius: 'var(--ds-radius-xl)',
        background: 'var(--ds-surface)',
        border: 'var(--ds-border-width) solid var(--ds-border)',
        boxShadow: 'var(--ds-shadow-lg)',
        display: 'grid',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <DsText as="h2" id="ds-dialog-title" variant="title">
          {title}
        </DsText>
        <button
          type="button"
          aria-label="Close"
          style={{ border: 0, background: 'transparent', color: 'var(--ds-ink-tertiary)', cursor: 'pointer' }}
        >
          <IconClose />
        </button>
      </div>
      <DsText variant="callout" tone="secondary">
        {body}
      </DsText>
      <div style={{ display: 'grid', gap: 8 }}>
        <DsButton fullWidth>{primaryLabel}</DsButton>
        <DsButton fullWidth variant="ghost">
          {secondaryLabel}
        </DsButton>
      </div>
    </div>
  )
}
