/**
 * Rahhal Design System — typed token map (documentation + TS consumers).
 * Runtime styling uses CSS variables in themes.css.
 */

export const DS_SPACING = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
  10: 64,
  11: 80,
  12: 96,
} as const

export const DS_RADIUS = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  '2xl': 36,
  full: 9999,
} as const

/** V2: no motion step exceeds 350ms */
export const DS_DURATION = {
  1: 120,
  2: 200,
  3: 280,
  4: 350,
} as const

export const DS_EASE = {
  standard: 'cubic-bezier(0.22, 1, 0.36, 1)',
  emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
} as const

export const DS_COLOR_ROLES = [
  'primary',
  'secondary',
  'background',
  'surface',
  'success',
  'warning',
  'error',
  'neutral',
] as const

export type DsThemeMode = 'light' | 'dark'
export type DsLocaleDir = 'rtl' | 'ltr'

export const DS_TYPOGRAPHY_SCALE = [
  'hero',
  'display',
  'title',
  'heading',
  'body',
  'callout',
  'caption',
  'micro',
] as const

/** CSS custom property names for documentation / tooling. */
export const DS_CSS_VARS = {
  primary: '--ds-primary',
  secondary: '--ds-secondary',
  bg: '--ds-bg',
  surface: '--ds-surface',
  ink: '--ds-ink',
  fontDisplay: '--ds-font-display',
  fontBody: '--ds-font-body',
} as const
