/**
 * Shared motion, theme, typography, spacing, and icon tokens for Integration Foundation.
 */

export const SHARED_SPACING = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '0.85rem',
  lg: '1.25rem',
  xl: '2rem',
} as const

export const SHARED_TYPOGRAPHY = {
  brand: 'clamp(1.8rem, 3.5vw, 2.6rem)',
  title: '1.15rem',
  body: '0.95rem',
  caption: '0.8rem',
  family: '"IBM Plex Sans Arabic", "SF Pro Display", "Segoe UI", sans-serif',
} as const

export const SHARED_MOTION = {
  enterMs: 220,
  pageMs: 280,
  transition: '180ms ease',
} as const

export const SHARED_ICONS = {
  module: '▣',
  flag: '⚑',
  graph: '⧉',
  status: '◎',
  architecture: '⬡',
  preview: '▷',
  demo: '✦',
  empty: '◌',
  loading: '◉',
  error: '✗',
} as const

export const ThemeRegistry = {
  modes: ['light', 'dark'] as const,
  resolve(theme: 'light' | 'dark') {
    return theme
  },
}

export function integrationTokenCssVariables(
  theme: 'light' | 'dark' = 'light',
): Record<string, string> {
  const dark = theme === 'dark'
  return {
    '--rahhal-if-max': '72rem',
    '--rahhal-if-radius': '1.1rem',
    '--rahhal-if-space-xs': SHARED_SPACING.xs,
    '--rahhal-if-space-sm': SHARED_SPACING.sm,
    '--rahhal-if-space-md': SHARED_SPACING.md,
    '--rahhal-if-space-lg': SHARED_SPACING.lg,
    '--rahhal-if-space-xl': SHARED_SPACING.xl,
    '--rahhal-if-font': SHARED_TYPOGRAPHY.family,
    '--rahhal-if-brand-size': SHARED_TYPOGRAPHY.brand,
    '--rahhal-if-title-size': SHARED_TYPOGRAPHY.title,
    '--rahhal-if-body-size': SHARED_TYPOGRAPHY.body,
    '--rahhal-if-caption-size': SHARED_TYPOGRAPHY.caption,
    '--rahhal-if-anim-enter': `${SHARED_MOTION.enterMs}ms`,
    '--rahhal-if-anim-page': `${SHARED_MOTION.pageMs}ms`,
    '--rahhal-if-transition': SHARED_MOTION.transition,
    '--rahhal-if-bg': dark
      ? 'linear-gradient(165deg, #020617 0%, #0f172a 48%, #042f2e 100%)'
      : 'linear-gradient(165deg, #f8fafc 0%, #ecfeff 42%, #eef2ff 100%)',
    '--rahhal-if-ink': dark ? '#e2e8f0' : '#0f172a',
    '--rahhal-if-muted': dark ? '#94a3b8' : '#64748b',
    '--rahhal-if-panel': dark
      ? 'rgba(15, 23, 42, 0.74)'
      : 'rgba(255, 255, 255, 0.92)',
    '--rahhal-if-accent': dark ? '#5eead4' : '#0f766e',
    '--rahhal-if-line': dark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(15, 23, 42, 0.08)',
    '--rahhal-if-danger': dark ? '#fca5a5' : '#b91c1c',
  }
}

export const IconRegistry = SHARED_ICONS
