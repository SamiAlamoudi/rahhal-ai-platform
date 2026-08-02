import type { ReactNode } from 'react'

/** Shared mobile screen frame for design-system shells. */
export function ScreenFrame({
  children,
  footer,
  pad = true,
}: {
  children: ReactNode
  footer?: ReactNode
  pad?: boolean
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--ds-brand-wash)',
      }}
    >
      <div
        className="ds-animate-enter"
        style={{
          flex: 1,
          overflow: 'auto',
          padding: pad ? '8px 20px 24px' : undefined,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {children}
      </div>
      {footer}
    </div>
  )
}
