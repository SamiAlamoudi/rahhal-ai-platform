/**
 * Rahhal Premium Experience V2 — magical voice, intelligent loading, illustrations.
 * UI polish only — no business logic.
 */

import type { CSSProperties, ReactNode } from 'react'
import { RahhalOrb, type RahhalOrbState } from '../brand/RahhalOrb'
import { IconCheck, IconSpark, IconWifiOff } from '../icons/OutlinedIcons'
import { DsButton, DsText } from './primitives'

/** Voice CTA — signature Rahhal Orb brand asset. */
export function DsVoiceOrb({
  listening = false,
  size = 96,
  label = 'Speak with Rahhal',
  state,
}: {
  listening?: boolean
  size?: number
  label?: string
  /** Optional explicit brand state; defaults from listening. */
  state?: RahhalOrbState
}) {
  const resolved: RahhalOrbState = state ?? (listening ? 'listening' : 'idle')
  return <RahhalOrb state={resolved} size={size} label={label} interactive />
}

export function DsTypingIndicator({ label = 'Rahhal is thinking' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        borderRadius: '18px 18px 18px 6px',
        background: 'var(--ds-surface)',
        border: 'var(--ds-border-width) solid var(--ds-border)',
        boxShadow: 'var(--ds-shadow-sm)',
      }}
    >
      <IconSpark size={16} style={{ color: 'var(--ds-secondary)' }} />
      <span style={{ display: 'inline-flex', gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--ds-ink-tertiary)',
              animation: `ds-typing-dot 1s var(--ds-ease-standard) ${i * 0.12}s infinite`,
            }}
          />
        ))}
      </span>
      <DsText variant="micro" tone="tertiary">
        Composing…
      </DsText>
    </div>
  )
}

export function DsStreamingLine({ text }: { text: string }) {
  return (
    <DsText variant="callout" style={{ display: 'inline' }}>
      {text}
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 2,
          height: '0.9em',
          marginInlineStart: 3,
          verticalAlign: '-0.1em',
          background: 'var(--ds-secondary)',
          animation: 'ds-stream-caret 0.9s var(--ds-ease-standard) infinite',
        }}
      />
    </DsText>
  )
}

export function DsPriceInsight({
  title = 'Price calm zone',
  note = 'Mid-week departures sit ~12% below weekend peaks.',
}: {
  title?: string
  note?: string
}) {
  const bars = [42, 58, 46, 70, 52, 38, 64]
  return (
    <div
      className="ds-animate-card ds-float-card"
      style={{
        padding: 16,
        borderRadius: 'var(--ds-radius-lg)',
        background: 'var(--ds-surface)',
        border: 'var(--ds-border-width) solid var(--ds-border)',
      }}
    >
      <DsText variant="heading">{title}</DsText>
      <div
        aria-hidden
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          height: 72,
          marginTop: 14,
        }}
      >
        {bars.map((h, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: `${h}%`,
              borderRadius: 6,
              background:
                i === 5
                  ? 'linear-gradient(180deg, var(--ds-tide-400), var(--ds-tide-600))'
                  : 'linear-gradient(180deg, var(--ds-ocean-200), var(--ds-ocean-400))',
              opacity: i === 5 ? 1 : 0.55,
            }}
          />
        ))}
      </div>
      <DsText variant="caption" tone="secondary" style={{ marginTop: 10 }}>
        {note}
      </DsText>
    </div>
  )
}

export function DsTrustStrip() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      {['Encrypted checkout', 'Transparent fare', 'Hold with confidence'].map((label) => (
        <span
          key={label}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 'var(--ds-radius-full)',
            background: 'var(--ds-primary-soft)',
            color: 'var(--ds-primary)',
            fontSize: 'var(--ds-text-micro)',
            fontWeight: 600,
          }}
        >
          <IconCheck size={12} />
          {label}
        </span>
      ))}
    </div>
  )
}

export function DsBookingProgress({ step, steps }: { step: number; steps: string[] }) {
  return (
    <ol
      aria-label="Booking progress"
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
        gap: 8,
      }}
    >
      {steps.map((label, index) => {
        const done = index < step
        const current = index === step
        return (
          <li key={label} style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
            <span
              style={{
                width: '100%',
                height: 4,
                borderRadius: 99,
                background: done || current ? 'var(--ds-primary)' : 'var(--ds-surface-muted)',
                opacity: current ? 1 : done ? 0.7 : 1,
                transition: `background var(--ds-duration-3) var(--ds-ease-standard)`,
              }}
            />
            <DsText variant="micro" tone={current ? 'primary' : 'tertiary'}>
              {label}
            </DsText>
          </li>
        )
      })}
    </ol>
  )
}

export function DsMapExperience() {
  return (
    <div
      aria-label="Travel map"
      className="ds-animate-card"
      style={{
        position: 'relative',
        height: 220,
        borderRadius: 'var(--ds-radius-xl)',
        overflow: 'hidden',
        border: 'var(--ds-border-width) solid var(--ds-border)',
        background:
          'radial-gradient(circle at 30% 40%, rgba(42,157,143,0.22), transparent 40%), radial-gradient(circle at 70% 60%, rgba(15,76,117,0.28), transparent 45%), linear-gradient(160deg, #d7e7f2, #b9d0df)',
        boxShadow: 'var(--ds-shadow-md)',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.35,
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: '28%',
          top: '42%',
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: 'var(--ds-ocean-600)',
          boxShadow: '0 0 0 8px rgba(15,76,117,0.18)',
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: '62%',
          top: '34%',
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: 'var(--ds-tide-500)',
          boxShadow: '0 0 0 8px rgba(42,157,143,0.2)',
        }}
      />
      <div
        className="ds-glass"
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          padding: '12px 14px',
          borderRadius: 'var(--ds-radius-md)',
          border: 'var(--ds-border-width) solid var(--ds-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          boxShadow: 'var(--ds-shadow-sm)',
        }}
      >
        <div>
          <DsText variant="heading">Medina arrival</DsText>
          <DsText variant="micro" tone="secondary">
            18 min · calm transfer
          </DsText>
        </div>
        <DsButton size="sm" variant="soft">
          Details
        </DsButton>
      </div>
    </div>
  )
}

/** Minimal premium travel illustration — geometric, not cartoon. */
export function DsTravelIllustration({
  kind = 'journey',
  size = 120,
}: {
  kind?: 'journey' | 'empty' | 'offline' | 'success'
  size?: number
}) {
  const style: CSSProperties = { width: size, height: size }
  if (kind === 'offline') {
    return (
      <div style={{ ...style, display: 'grid', placeItems: 'center', color: 'var(--ds-primary)' }}>
        <span
          style={{
            width: size * 0.72,
            height: size * 0.72,
            borderRadius: '50%',
            background: 'var(--ds-primary-soft)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <IconWifiOff size={size * 0.32} />
        </span>
      </div>
    )
  }
  if (kind === 'success') {
    return (
      <div style={{ ...style, position: 'relative', display: 'grid', placeItems: 'center' }}>
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: '12%',
            borderRadius: '50%',
            border: '1px solid var(--ds-tide-400)',
            animation: 'ds-success-ring 0.9s var(--ds-ease-emphasized) both',
          }}
        />
        <span
          style={{
            width: '58%',
            height: '58%',
            borderRadius: '50%',
            background: 'linear-gradient(160deg, var(--ds-tide-400), var(--ds-ocean-600))',
            color: 'var(--ds-ink-inverse)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: 'var(--ds-shadow-md)',
          }}
        >
          <IconCheck size={size * 0.22} />
        </span>
      </div>
    )
  }
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden style={style}>
      <defs>
        <linearGradient id="dsHorizon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--ds-ocean-300)" />
          <stop offset="100%" stopColor="var(--ds-tide-400)" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="52" fill="var(--ds-primary-soft)" />
      <path d="M18 78c18-18 36-18 54 0s36 18 54 0" stroke="url(#dsHorizon)" strokeWidth="3" fill="none" />
      <path
        d="M34 64c10-22 22-34 34-34 8 0 14 6 14 14 0 18-20 28-34 34-8 4-16 2-14-14Z"
        fill="var(--ds-ocean-500)"
        opacity="0.9"
      />
      <circle cx="84" cy="38" r="6" fill="var(--ds-tide-300)" />
    </svg>
  )
}

export function DsPremiumEmpty({
  title,
  body,
  action,
  kind = 'empty',
}: {
  title: string
  body: string
  action?: ReactNode
  kind?: 'journey' | 'empty' | 'offline' | 'success'
}) {
  return (
    <div
      className="ds-animate-enter"
      style={{
        display: 'grid',
        gap: 16,
        justifyItems: 'center',
        textAlign: 'center',
        padding: '36px 20px',
      }}
    >
      <DsTravelIllustration kind={kind} size={132} />
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

export function DsAiThinkingRail() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Rahhal is thinking"
      className="ds-glass"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 'var(--ds-radius-full)',
        border: 'var(--ds-border-width) solid var(--ds-border)',
        width: 'fit-content',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--ds-secondary)',
          boxShadow: '0 0 0 4px var(--ds-secondary-soft)',
          animation: 'ds-soft-pulse 1.6s var(--ds-ease-breathe) infinite',
        }}
      />
      <DsText variant="caption" tone="secondary">
        Weighing calm routes & quiet stays…
      </DsText>
    </div>
  )
}
