/**
 * Rahhal Design System — travel interaction surfaces (placeholders only).
 */

import type { ReactNode } from 'react'
import { IconHeart, IconMap, IconPlane, IconSearch, IconSpark } from '../icons/OutlinedIcons'
import { DsButton, DsSurface, DsText } from './primitives'

export function DsSearchField({
  placeholder = 'Ask Rahhal…',
  value,
}: {
  placeholder?: string
  value?: string
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        padding: '0 16px',
        borderRadius: 'var(--ds-radius-full)',
        background: 'var(--ds-surface)',
        border: 'var(--ds-border-width) solid var(--ds-border)',
        boxShadow: 'var(--ds-shadow-sm)',
      }}
    >
      <IconSearch aria-hidden />
      <input
        readOnly
        value={value ?? ''}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{
          flex: 1,
          border: 0,
          outline: 'none',
          background: 'transparent',
          fontFamily: 'var(--ds-font-body)',
          fontSize: 'var(--ds-text-body)',
          color: 'var(--ds-ink)',
        }}
      />
    </label>
  )
}

export { DsVoiceOrb as DsVoiceButton } from './premium'

export function DsFlightCard({
  from = 'RUH',
  to = 'DXB',
  time = '08:40 → 11:05',
  price = 'SAR 1,280',
  meta = 'Nonstop · 2h 25m',
}: {
  from?: string
  to?: string
  time?: string
  price?: string
  meta?: string
}) {
  return (
    <DsSurface
      elevated
      padding={18}
      className="ds-animate-card ds-float-card"
      aria-label={`Flight ${from} to ${to}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--ds-radius-md)',
              background: 'var(--ds-primary-soft)',
              color: 'var(--ds-primary)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <IconPlane />
          </span>
          <div>
            <DsText as="h3" variant="heading">
              {from} — {to}
            </DsText>
            <DsText variant="caption" tone="secondary">
              {time}
            </DsText>
          </div>
        </div>
        <DsText variant="heading" tone="primary">
          {price}
        </DsText>
      </div>
      <DsText variant="caption" tone="tertiary" style={{ marginTop: 12 }}>
        {meta}
      </DsText>
    </DsSurface>
  )
}

export function DsHotelCard({
  name = 'Coastal Quiet Hotel',
  area = 'Corniche · 4.8',
  price = 'SAR 620 / night',
}: {
  name?: string
  area?: string
  price?: string
}) {
  return (
    <DsSurface elevated padding={0} className="ds-animate-card ds-float-card" style={{ overflow: 'hidden' }}>
      <div
        aria-hidden
        style={{
          height: 120,
          background:
            'linear-gradient(135deg, rgba(15,76,117,0.88), rgba(42,157,143,0.55)), linear-gradient(90deg, #7aa8c4, #b8d4e8)',
        }}
      />
      <div style={{ padding: 16, display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <DsText as="h3" variant="heading">
            {name}
          </DsText>
          <button
            type="button"
            aria-label="Save"
            style={{ border: 0, background: 'transparent', color: 'var(--ds-ink-tertiary)', cursor: 'pointer' }}
          >
            <IconHeart />
          </button>
        </div>
        <DsText variant="caption" tone="secondary">
          {area}
        </DsText>
        <DsText variant="callout" tone="primary">
          {price}
        </DsText>
      </div>
    </DsSurface>
  )
}

export function DsPackageCard({
  title = 'Marrakech Calm Escape',
  nights = '4 nights',
  price = 'SAR 4,900',
}: {
  title?: string
  nights?: string
  price?: string
}) {
  return (
    <DsSurface elevated padding={18}>
      <DsText variant="micro" tone="primary" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Package
      </DsText>
      <DsText as="h3" variant="title" style={{ marginTop: 6 }}>
        {title}
      </DsText>
      <DsText variant="caption" tone="secondary" style={{ marginTop: 6 }}>
        {nights} · flights + stay + transfers
      </DsText>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <DsText variant="heading">{price}</DsText>
        <DsButton size="sm" variant="soft">
          View
        </DsButton>
      </div>
    </DsSurface>
  )
}

export function DsRecommendationCard({
  title = 'Quieter arrival window',
  body = 'Landing mid-morning avoids peak traffic to the medina.',
}: {
  title?: string
  body?: string
}) {
  return (
    <DsSurface
      padding={16}
      style={{
        background: 'var(--ds-secondary-soft)',
        borderColor: 'transparent',
      }}
    >
      <div style={{ display: 'flex', gap: 10 }}>
        <IconSpark style={{ color: 'var(--ds-secondary)', flexShrink: 0 }} />
        <div>
          <DsText as="h3" variant="heading">
            {title}
          </DsText>
          <DsText variant="caption" tone="secondary" style={{ marginTop: 4 }}>
            {body}
          </DsText>
        </div>
      </div>
    </DsSurface>
  )
}

export function DsPriceCard({
  label = 'Total',
  amount = 'SAR 6,420',
  note = 'Taxes included · refundable until Thu',
}: {
  label?: string
  amount?: string
  note?: string
}) {
  return (
    <DsSurface elevated padding={18}>
      <DsText variant="caption" tone="secondary">
        {label}
      </DsText>
      <DsText as="p" variant="display" style={{ marginTop: 4 }}>
        {amount}
      </DsText>
      <DsText variant="micro" tone="tertiary" style={{ marginTop: 8 }}>
        {note}
      </DsText>
    </DsSurface>
  )
}

export function DsTimeline({
  items,
}: {
  items: Array<{ time: string; title: string; detail?: string }>
}) {
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 0 }}>
      {items.map((item, index) => (
        <li
          key={`${item.time}-${item.title}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '18px 1fr',
            gap: 12,
            paddingBottom: index === items.length - 1 ? 0 : 18,
          }}
        >
          <span style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'var(--ds-primary)',
                marginTop: 5,
                boxShadow: '0 0 0 4px var(--ds-primary-soft)',
              }}
            />
            {index < items.length - 1 ? (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 18,
                  bottom: -18,
                  width: 1,
                  background: 'var(--ds-border-strong)',
                }}
              />
            ) : null}
          </span>
          <div>
            <DsText variant="micro" tone="tertiary">
              {item.time}
            </DsText>
            <DsText variant="heading">{item.title}</DsText>
            {item.detail ? (
              <DsText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                {item.detail}
              </DsText>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function DsAiBubble({
  children,
  meta,
  rich,
}: {
  children: ReactNode
  meta?: string
  rich?: boolean
}) {
  return (
    <div
      className="ds-animate-enter"
      style={{ display: 'grid', gap: 8, justifyItems: 'start', maxWidth: rich ? '100%' : '92%' }}
    >
      <div
        style={{
          padding: rich ? 0 : '14px 16px',
          borderRadius: '20px 20px 20px 8px',
          background: rich
            ? 'transparent'
            : 'linear-gradient(180deg, var(--ds-surface), var(--ds-bg-elevated))',
          border: rich ? 'none' : 'var(--ds-border-width) solid var(--ds-border)',
          boxShadow: rich ? undefined : 'var(--ds-shadow-sm)',
          width: '100%',
          display: 'grid',
          gap: 10,
        }}
      >
        {typeof children === 'string' || !rich ? (
          <div style={rich ? undefined : undefined}>
            {typeof children === 'string' ? <DsText variant="callout">{children}</DsText> : children}
          </div>
        ) : (
          children
        )}
      </div>
      {meta ? (
        <DsText variant="micro" tone="tertiary">
          {meta}
        </DsText>
      ) : null}
    </div>
  )
}

export function DsUserBubble({ children }: { children: ReactNode }) {
  return (
    <div className="ds-animate-enter" style={{ display: 'grid', justifyItems: 'end' }}>
      <div
        style={{
          maxWidth: '86%',
          padding: '14px 16px',
          borderRadius: '20px 20px 8px 20px',
          background:
            'linear-gradient(160deg, var(--ds-ocean-500), var(--ds-ocean-700))',
          color: 'var(--ds-ink-inverse)',
          boxShadow: 'var(--ds-shadow-sm)',
        }}
      >
        <DsText variant="callout" tone="inverse">
          {children}
        </DsText>
      </div>
    </div>
  )
}

export function DsSuggestionCard({ label }: { label: string }) {
  return (
    <button
      type="button"
      style={{
        textAlign: 'start',
        padding: '12px 14px',
        borderRadius: 'var(--ds-radius-md)',
        border: 'var(--ds-border-width) solid var(--ds-border)',
        background: 'var(--ds-surface)',
        color: 'var(--ds-ink)',
        fontFamily: 'var(--ds-font-body)',
        fontSize: 'var(--ds-text-caption)',
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: 'var(--ds-shadow-xs)',
      }}
    >
      {label}
    </button>
  )
}

export function DsQuickAction({
  icon,
  label,
}: {
  icon: ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      style={{
        display: 'grid',
        gap: 10,
        justifyItems: 'center',
        padding: '14px 8px',
        borderRadius: 'var(--ds-radius-lg)',
        border: 'var(--ds-border-width) solid var(--ds-border)',
        background: 'var(--ds-surface)',
        color: 'var(--ds-ink)',
        cursor: 'pointer',
        minWidth: 72,
        boxShadow: 'var(--ds-shadow-xs)',
      }}
    >
      <span style={{ color: 'var(--ds-primary)', display: 'inline-flex' }}>{icon}</span>
      <span style={{ fontSize: 'var(--ds-text-micro)', fontWeight: 600 }}>{label}</span>
    </button>
  )
}

export function DsStatePanel({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 14,
        justifyItems: 'center',
        textAlign: 'center',
        padding: '40px 24px',
      }}
    >
      <span
        style={{
          width: 64,
          height: 64,
          borderRadius: 'var(--ds-radius-full)',
          background: 'var(--ds-primary-soft)',
          color: 'var(--ds-primary)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {icon}
      </span>
      <DsText as="h2" variant="title">
        {title}
      </DsText>
      <DsText variant="callout" tone="secondary" style={{ maxWidth: 280 }}>
        {body}
      </DsText>
      {action}
    </div>
  )
}

export function DsMapPlaceholder() {
  return (
    <div
      aria-label="Map preview"
      style={{
        height: 140,
        borderRadius: 'var(--ds-radius-lg)',
        background:
          'linear-gradient(160deg, rgba(15,76,117,0.12), rgba(42,157,143,0.18)), var(--ds-surface-muted)',
        border: 'var(--ds-border-width) solid var(--ds-border)',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--ds-ink-tertiary)',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <IconMap />
        <DsText variant="caption" tone="tertiary">
          Map preview
        </DsText>
      </span>
    </div>
  )
}

export function DsMetaRow({
  items,
}: {
  items: Array<{ icon: ReactNode; label: string }>
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {items.map((item) => (
        <span
          key={item.label}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--ds-ink-secondary)',
            fontSize: 'var(--ds-text-caption)',
          }}
        >
          {item.icon}
          {item.label}
        </span>
      ))}
    </div>
  )
}
