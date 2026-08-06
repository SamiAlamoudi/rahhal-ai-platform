/**
 * Bilamo Design System — production tokens.
 * Premium AI · Conversation-first · Liquid glass · Soft depth.
 */

export const BILAMO_DESIGN_SYSTEM_VERSION = '1.0.0'

export const brand = {
  name: 'Bilamo',
  tagline: 'Intelligence, in conversation.',
} as const

/** Semantic color roles — CSS variables resolve dark/light at runtime. */
export const colorRoles = {
  background: 'var(--bilamo-bg)',
  surface: 'var(--bilamo-surface)',
  surfaceElevated: 'var(--bilamo-surface-elevated)',
  primary: 'var(--bilamo-primary)',
  secondary: 'var(--bilamo-secondary)',
  text: 'var(--bilamo-text)',
  muted: 'var(--bilamo-muted)',
  border: 'var(--bilamo-border)',
  glass: 'var(--bilamo-glass)',
  glassBorder: 'var(--bilamo-glass-border)',
  glowPrimary: 'var(--bilamo-glow-primary)',
  glowSecondary: 'var(--bilamo-glow-secondary)',
  danger: 'var(--bilamo-danger)',
  success: 'var(--bilamo-success)',
} as const

export const darkPalette = {
  background: '#050816',
  surface: '#0D1327',
  surfaceElevated: '#141B33',
  primary: '#7C3AED',
  secondary: '#22D3EE',
  text: '#F8FAFC',
  muted: '#94A3B8',
  border: 'rgba(255,255,255,0.08)',
  glass: 'rgba(13, 19, 39, 0.55)',
  glassBorder: 'rgba(255,255,255,0.10)',
  glowPrimary: 'rgba(124, 58, 237, 0.45)',
  glowSecondary: 'rgba(34, 211, 238, 0.35)',
  danger: '#F43F5E',
  success: '#34D399',
} as const

export const lightPalette = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  primary: '#6D28D9',
  secondary: '#0891B2',
  text: '#0F172A',
  muted: '#64748B',
  border: 'rgba(15, 23, 42, 0.08)',
  glass: 'rgba(255, 255, 255, 0.72)',
  glassBorder: 'rgba(15, 23, 42, 0.08)',
  glowPrimary: 'rgba(109, 40, 217, 0.22)',
  glowSecondary: 'rgba(8, 145, 178, 0.18)',
  danger: '#E11D48',
  success: '#059669',
} as const

export const typography = {
  family: {
    sans: '"Geist Variable", Geist, ui-sans-serif, system-ui, sans-serif',
  },
  size: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.375rem',
    '2xl': '1.75rem',
    '3xl': '2.25rem',
    '4xl': '3rem',
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
  },
  tracking: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.04em',
  },
} as const

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  full: 9999,
} as const

export const elevation = {
  none: 'none',
  soft: '0 8px 32px rgba(0,0,0,0.18)',
  glass: '0 12px 40px rgba(0,0,0,0.22)',
  orb: '0 0 80px var(--bilamo-glow-primary)',
} as const

/** Framer Motion spring presets — Apple-soft, no hard edges. */
export const springs = {
  gentle: { type: 'spring' as const, stiffness: 100, damping: 22, mass: 1 },
  soft: { type: 'spring' as const, stiffness: 180, damping: 26, mass: 0.95 },
  snappy: { type: 'spring' as const, stiffness: 320, damping: 32, mass: 0.75 },
  orb: { type: 'spring' as const, stiffness: 70, damping: 18, mass: 1.15 },
  press: { type: 'spring' as const, stiffness: 480, damping: 34, mass: 0.6 },
}

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'completed'

export const orbStateLabels: Record<OrbState, string> = {
  idle: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  completed: 'Done',
}
