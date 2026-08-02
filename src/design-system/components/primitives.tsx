/**
 * Rahhal Design System — core primitives (UI only, no business logic).
 */

import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  forwardRef,
} from 'react'

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function DsText({
  as: Tag = 'p',
  variant = 'body',
  tone = 'default',
  className,
  style,
  children,
  ...rest
}: {
  as?: 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'label'
  variant?: 'hero' | 'display' | 'title' | 'heading' | 'body' | 'callout' | 'caption' | 'micro'
  tone?: 'default' | 'secondary' | 'tertiary' | 'inverse' | 'primary' | 'success' | 'warning' | 'error'
  className?: string
  style?: CSSProperties
  children: ReactNode
} & HTMLAttributes<HTMLElement>) {
  const size: Record<string, string> = {
    hero: 'var(--ds-text-hero)',
    display: 'var(--ds-text-display)',
    title: 'var(--ds-text-title)',
    heading: 'var(--ds-text-heading)',
    body: 'var(--ds-text-body)',
    callout: 'var(--ds-text-callout)',
    caption: 'var(--ds-text-caption)',
    micro: 'var(--ds-text-micro)',
  }
  const color: Record<string, string> = {
    default: 'var(--ds-ink)',
    secondary: 'var(--ds-ink-secondary)',
    tertiary: 'var(--ds-ink-tertiary)',
    inverse: 'var(--ds-ink-inverse)',
    primary: 'var(--ds-primary)',
    success: 'var(--ds-success-500)',
    warning: 'var(--ds-warning-500)',
    error: 'var(--ds-error-500)',
  }
  return (
    <Tag
      className={className}
      style={{
        margin: 0,
        fontFamily:
          variant === 'hero' || variant === 'display' || variant === 'title'
            ? 'var(--ds-font-display)'
            : 'var(--ds-font-body)',
        fontSize: size[variant],
        lineHeight:
          variant === 'hero' || variant === 'display'
            ? 'var(--ds-leading-tight)'
            : 'var(--ds-leading-normal)',
        letterSpacing:
          variant === 'hero' || variant === 'display'
            ? 'var(--ds-tracking-tight)'
            : 'var(--ds-tracking-normal)',
        fontWeight: variant === 'hero' || variant === 'display' ? 700 : variant === 'title' || variant === 'heading' ? 600 : 500,
        color: color[tone],
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export const DsButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    fullWidth?: boolean
    leadingIcon?: ReactNode
    trailingIcon?: ReactNode
  }
>(function DsButton(
  {
    variant = 'primary',
    size = 'md',
    fullWidth,
    leadingIcon,
    trailingIcon,
    className,
    style,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const pad =
    size === 'sm'
      ? '8px 14px'
      : size === 'lg'
        ? '16px 22px'
        : '12px 18px'
  const backgrounds: Record<string, string> = {
    primary: 'var(--ds-primary)',
    secondary: 'var(--ds-secondary)',
    ghost: 'transparent',
    soft: 'var(--ds-primary-soft)',
    danger: 'var(--ds-error-500)',
  }
  const colors: Record<string, string> = {
    primary: 'var(--ds-ink-inverse)',
    secondary: 'var(--ds-ink-inverse)',
    ghost: 'var(--ds-ink)',
    soft: 'var(--ds-primary)',
    danger: 'var(--ds-ink-inverse)',
  }
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={cx('ds-btn', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: fullWidth ? '100%' : undefined,
        padding: pad,
        borderRadius: 'var(--ds-radius-full)',
        border:
          variant === 'ghost'
            ? 'var(--ds-border-width) solid var(--ds-border-strong)'
            : 'var(--ds-border-width) solid transparent',
        background: backgrounds[variant],
        color: colors[variant],
        fontFamily: 'var(--ds-font-display)',
        fontWeight: 600,
        fontSize: size === 'sm' ? 'var(--ds-text-caption)' : 'var(--ds-text-callout)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 'var(--ds-opacity-disabled)' : 1,
        transition: `transform var(--ds-duration-1) var(--ds-ease-standard), background var(--ds-duration-2) var(--ds-ease-standard)`,
        boxShadow: variant === 'primary' ? 'var(--ds-shadow-sm)' : undefined,
        ...style,
      }}
      {...rest}
    >
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </button>
  )
})

export const DsInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label?: string
    hint?: string
    error?: string
    leadingIcon?: ReactNode
  }
>(function DsInput({ label, hint, error, leadingIcon, id, style, ...rest }, ref) {
  const inputId = id ?? rest.name
  return (
    <label
      htmlFor={inputId}
      style={{ display: 'grid', gap: 8, width: '100%', ...style }}
    >
      {label ? (
        <DsText as="span" variant="caption" tone="secondary">
          {label}
        </DsText>
      ) : null}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 52,
          padding: '0 16px',
          borderRadius: 'var(--ds-radius-md)',
          background: 'var(--ds-surface)',
          border: `var(--ds-border-width) solid ${error ? 'var(--ds-error-500)' : 'var(--ds-border)'}`,
          boxShadow: 'var(--ds-shadow-xs)',
        }}
      >
        {leadingIcon ? (
          <span style={{ color: 'var(--ds-ink-tertiary)', display: 'inline-flex' }}>
            {leadingIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          style={{
            flex: 1,
            border: 0,
            outline: 'none',
            background: 'transparent',
            color: 'var(--ds-ink)',
            fontFamily: 'var(--ds-font-body)',
            fontSize: 'var(--ds-text-body)',
            minWidth: 0,
          }}
          {...rest}
        />
      </span>
      {error ? (
        <DsText variant="micro" tone="error" role="alert">
          {error}
        </DsText>
      ) : hint ? (
        <DsText variant="micro" tone="tertiary">
          {hint}
        </DsText>
      ) : null}
    </label>
  )
})

export function DsChip({
  children,
  active,
  onClick,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 'var(--ds-radius-full)',
        border: `var(--ds-border-width) solid ${active ? 'transparent' : 'var(--ds-border)'}`,
        background: active ? 'var(--ds-primary)' : 'var(--ds-surface)',
        color: active ? 'var(--ds-ink-inverse)' : 'var(--ds-ink-secondary)',
        fontFamily: 'var(--ds-font-body)',
        fontSize: 'var(--ds-text-caption)',
        fontWeight: 600,
        cursor: 'pointer',
        transition: `background var(--ds-duration-2) var(--ds-ease-standard)`,
      }}
    >
      {children}
    </button>
  )
}

export function DsAvatar({
  initials = 'ر',
  size = 40,
  src,
  alt,
}: {
  initials?: string
  size?: number
  src?: string
  alt?: string
}) {
  return (
    <span
      role={alt ? 'img' : undefined}
      aria-label={alt}
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--ds-radius-full)',
        display: 'inline-grid',
        placeItems: 'center',
        background: src
          ? `center/cover url(${src})`
          : 'linear-gradient(145deg, var(--ds-ocean-500), var(--ds-tide-500))',
        color: 'var(--ds-ink-inverse)',
        fontFamily: 'var(--ds-font-display)',
        fontWeight: 700,
        fontSize: size * 0.38,
        boxShadow: 'var(--ds-shadow-xs)',
        overflow: 'hidden',
      }}
    >
      {src ? null : initials}
    </span>
  )
}

export function DsSurface({
  children,
  padding = 16,
  elevated,
  glass,
  className,
  style,
  as: Tag = 'div',
  ...rest
}: {
  children: ReactNode
  padding?: number
  elevated?: boolean
  glass?: boolean
  className?: string
  style?: CSSProperties
  as?: 'div' | 'section' | 'article'
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={className}
      style={{
        padding,
        borderRadius: 'var(--ds-radius-lg)',
        background: glass ? 'var(--ds-surface-glass)' : 'var(--ds-surface)',
        border: 'var(--ds-border-width) solid var(--ds-border)',
        boxShadow: elevated ? 'var(--ds-shadow-md)' : 'var(--ds-shadow-xs)',
        backdropFilter: glass ? 'blur(16px)' : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function DsProgress({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      style={{ display: 'grid', gap: 8 }}
    >
      <div
        style={{
          height: 6,
          borderRadius: 'var(--ds-radius-full)',
          background: 'var(--ds-surface-muted)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            borderRadius: 'inherit',
            background: 'linear-gradient(90deg, var(--ds-primary), var(--ds-secondary))',
            transition: `width var(--ds-duration-3) var(--ds-ease-emphasized)`,
          }}
        />
      </div>
    </div>
  )
}

export function DsSkeleton({
  height = 16,
  width = '100%',
  radius = 'var(--ds-radius-sm)',
}: {
  height?: number | string
  width?: number | string
  radius?: string
}) {
  return (
    <div
      aria-hidden
      style={{
        height,
        width,
        borderRadius: radius,
        background:
          'linear-gradient(90deg, var(--ds-surface-muted) 25%, var(--ds-neutral-200) 50%, var(--ds-surface-muted) 75%)',
        backgroundSize: '200% 100%',
        animation: 'ds-shimmer 1.4s linear infinite',
      }}
    />
  )
}

export function DsSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: '2px solid var(--ds-border-strong)',
        borderTopColor: 'var(--ds-primary)',
        animation: 'ds-soft-pulse var(--ds-duration-4) var(--ds-ease-standard) infinite',
      }}
    />
  )
}

export function DsSnackbar({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'success' | 'warning' | 'error'
  children: ReactNode
}) {
  const bg =
    tone === 'success'
      ? 'var(--ds-success-50)'
      : tone === 'warning'
        ? 'var(--ds-warning-50)'
        : tone === 'error'
          ? 'var(--ds-error-50)'
          : 'var(--ds-surface)'
  return (
    <div
      role="status"
      style={{
        padding: '14px 16px',
        borderRadius: 'var(--ds-radius-md)',
        background: bg,
        border: 'var(--ds-border-width) solid var(--ds-border)',
        boxShadow: 'var(--ds-shadow-md)',
        color: 'var(--ds-ink)',
        fontSize: 'var(--ds-text-callout)',
      }}
    >
      {children}
    </div>
  )
}

export function DsTabs({
  items,
  value,
  onChange,
}: {
  items: Array<{ id: string; label: string }>
  value: string
  onChange?: (id: string) => void
}) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        borderRadius: 'var(--ds-radius-full)',
        background: 'var(--ds-surface-muted)',
      }}
    >
      {items.map((item) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange?.(item.id)}
            style={{
              flex: 1,
              padding: '10px 12px',
              border: 0,
              borderRadius: 'var(--ds-radius-full)',
              background: selected ? 'var(--ds-surface)' : 'transparent',
              color: selected ? 'var(--ds-ink)' : 'var(--ds-ink-tertiary)',
              boxShadow: selected ? 'var(--ds-shadow-xs)' : undefined,
              fontWeight: 600,
              fontFamily: 'var(--ds-font-body)',
              fontSize: 'var(--ds-text-caption)',
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export function DsBottomNav({
  items,
  activeId,
}: {
  items: Array<{ id: string; label: string; icon: ReactNode }>
  activeId: string
}) {
  return (
    <nav
      aria-label="Primary"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        gap: 4,
        padding: '10px 12px calc(10px + var(--ds-safe-bottom))',
        background: 'var(--ds-surface-glass)',
        backdropFilter: 'blur(18px)',
        borderTop: 'var(--ds-border-width) solid var(--ds-border)',
      }}
    >
      {items.map((item) => {
        const active = item.id === activeId
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'grid',
              justifyItems: 'center',
              gap: 4,
              border: 0,
              background: 'transparent',
              color: active ? 'var(--ds-primary)' : 'var(--ds-ink-tertiary)',
              fontSize: 'var(--ds-text-micro)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--ds-font-body)',
            }}
          >
            <span style={{ display: 'inline-flex' }}>{item.icon}</span>
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

export function DsPhoneShell({
  children,
  title,
}: {
  children: ReactNode
  title?: string
}) {
  return (
    <div
      style={{
        width: 'min(100%, var(--ds-phone-width))',
        minHeight: 760,
        borderRadius: 'var(--ds-radius-2xl)',
        overflow: 'hidden',
        border: 'var(--ds-border-width) solid var(--ds-border-strong)',
        background: 'var(--ds-brand-wash)',
        boxShadow: 'var(--ds-shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {title ? (
        <div
          style={{
            padding: '14px 18px 8px',
            display: 'flex',
            justifyContent: 'space-between',
            color: 'var(--ds-ink-tertiary)',
            fontSize: 'var(--ds-text-micro)',
            fontWeight: 600,
          }}
        >
          <span>9:41</span>
          <span>{title}</span>
        </div>
      ) : null}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {children}
      </div>
    </div>
  )
}
