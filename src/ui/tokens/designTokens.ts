/**
 * Sprint 119 — Design tokens (centralized). Presentation only.
 * Consumers must reference tokens — avoid hardcoded spacing/radius/type in UI modules.
 */

export const SPRINT119_UI_EXPERIENCE_VERSION = '1.0.0-experience-v1'

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const

export const typography = {
  family: {
    display: 'Cairo, Tajawal, system-ui, sans-serif',
    body: 'Cairo, Tajawal, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    '2xl': 28,
    '3xl': 36,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.65,
  },
} as const

export const elevation = {
  none: 'none',
  sm: '0 1px 2px rgba(18, 46, 87, 0.08)',
  md: '0 4px 12px rgba(18, 46, 87, 0.10)',
  lg: '0 12px 28px rgba(18, 46, 87, 0.14)',
} as const

export const animation = {
  duration: {
    instant: 0,
    fast: 120,
    normal: 220,
    slow: 360,
    deliberate: 520,
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const

export const iconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const

export const componentSize = {
  controlHeight: {
    sm: 36,
    md: 44,
    lg: 52,
  },
  cardMinWidth: {
    sm: 240,
    md: 320,
    lg: 400,
  },
  bubbleMaxWidth: {
    sm: '78%',
    md: '72%',
    lg: '64%',
  },
} as const

export const designTokens = {
  spacing,
  radius,
  typography,
  elevation,
  animation,
  iconSize,
  componentSize,
} as const

export type DesignTokens = typeof designTokens

export function tokenCssVariables(): Record<string, string> {
  return {
    '--ui-space-xs': `${spacing.xs}px`,
    '--ui-space-sm': `${spacing.sm}px`,
    '--ui-space-md': `${spacing.md}px`,
    '--ui-space-lg': `${spacing.lg}px`,
    '--ui-space-xl': `${spacing.xl}px`,
    '--ui-radius-md': `${radius.md}px`,
    '--ui-radius-lg': `${radius.lg}px`,
    '--ui-font-body': typography.family.body,
    '--ui-font-size-md': `${typography.size.md}px`,
    '--ui-elevation-md': elevation.md,
    '--ui-duration-normal': `${animation.duration.normal}ms`,
    '--ui-icon-md': `${iconSize.md}px`,
    '--ui-control-height-md': `${componentSize.controlHeight.md}px`,
  }
}
