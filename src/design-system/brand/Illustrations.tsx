/**
 * Rahhal illustration language — minimal, elegant, international.
 * Geometric horizon + dune forms. Never cartoon / stock.
 */

import type { CSSProperties } from 'react'

export type RahhalIllustrationKind =
  | 'horizon'
  | 'dune'
  | 'companion'
  | 'atlas'
  | 'calm-sea'
  | 'arrival'

export const RAHHAL_ILLUSTRATION_KINDS: RahhalIllustrationKind[] = [
  'horizon',
  'dune',
  'companion',
  'atlas',
  'calm-sea',
  'arrival',
]

export function RahhalIllustration({
  kind = 'horizon',
  size = 140,
  title,
}: {
  kind?: RahhalIllustrationKind
  size?: number
  title?: string
}) {
  const style: CSSProperties = { width: size, height: size, display: 'block' }
  const gid = `rh-${kind}`

  return (
    <svg
      viewBox="0 0 140 140"
      width={size}
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={style}
    >
      <defs>
        <linearGradient id={`${gid}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f4c75" />
          <stop offset="55%" stopColor="#256fa0" />
          <stop offset="100%" stopColor="#2a9d8f" />
        </linearGradient>
        <linearGradient id={`${gid}-b`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#2a9d8f" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#7ab0d4" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={`${gid}-glow`} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#2a9d8f" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0f4c75" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="70" cy="70" r="64" fill={`url(#${gid}-glow)`} />
      <circle cx="70" cy="70" r="52" fill="var(--ds-primary-soft)" />

      {kind === 'horizon' || kind === 'calm-sea' ? (
        <>
          <path
            d="M16 86c22-20 42-20 62 0s40 20 62 0"
            stroke={`url(#${gid}-a)`}
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M22 96c18-12 36-12 54 0s36 12 54 0"
            stroke={`url(#${gid}-b)`}
            strokeWidth="2"
            fill="none"
            opacity="0.7"
          />
          <circle cx="104" cy="42" r="7" fill="#3aad9a" opacity="0.9" />
        </>
      ) : null}

      {kind === 'dune' || kind === 'atlas' ? (
        <>
          <path
            d="M24 98c18-28 34-40 46-40 14 0 22 12 22 24 0 22-24 34-42 40-12 4-22 0-26-24Z"
            fill={`url(#${gid}-a)`}
            opacity="0.92"
          />
          <path
            d="M70 100c14-18 28-26 40-24 10 2 14 12 12 22-4 18-22 26-38 28-10 2-16-4-14-26Z"
            fill={`url(#${gid}-b)`}
          />
        </>
      ) : null}

      {kind === 'companion' || kind === 'arrival' ? (
        <>
          <circle cx="70" cy="58" r="18" fill={`url(#${gid}-a)`} />
          <circle cx="62" cy="52" r="4" fill="rgba(255,252,248,0.55)" />
          <path
            d="M48 98c6-16 14-24 22-24s16 8 22 24"
            stroke={`url(#${gid}-b)`}
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
        </>
      ) : null}

      {kind === 'atlas' ? (
        <circle
          cx="70"
          cy="70"
          r="38"
          fill="none"
          stroke="rgba(15,76,117,0.25)"
          strokeWidth="1.5"
          strokeDasharray="3 5"
        />
      ) : null}
    </svg>
  )
}

export function RahhalIllustrationRow() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
      {RAHHAL_ILLUSTRATION_KINDS.map((kind) => (
        <figure key={kind} style={{ margin: 0, textAlign: 'center' }}>
          <RahhalIllustration kind={kind} size={112} title={kind} />
          <figcaption
            style={{
              marginTop: 8,
              fontSize: 'var(--ds-text-micro)',
              color: 'var(--ds-ink-tertiary)',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {kind}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
