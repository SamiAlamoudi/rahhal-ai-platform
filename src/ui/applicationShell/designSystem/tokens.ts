/**
 * Phase 4 Stage 1 — Application Shell design tokens.
 * Independent from quarantined Sprint 119 tokens.
 */

import type { ShellDesignTokens, ShellPrimitiveCatalog } from '../types'

export const SHELL_DESIGN_TOKENS: ShellDesignTokens = {
  typography: {
    fontFamilyDisplay: 'Cairo, Tajawal, "Segoe UI", sans-serif',
    fontFamilyBody: 'Cairo, Tajawal, "Segoe UI", sans-serif',
    sizeXs: 12,
    sizeSm: 14,
    sizeMd: 16,
    sizeLg: 18,
    sizeXl: 22,
    size2xl: 28,
  },
  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    pill: 999,
  },
  elevation: {
    none: 'none',
    sm: '0 1px 2px rgba(15, 23, 42, 0.06)',
    md: '0 4px 12px rgba(15, 23, 42, 0.08)',
    lg: '0 12px 28px rgba(15, 23, 42, 0.12)',
  },
}

export const SHELL_PRIMITIVE_CATALOG: ShellPrimitiveCatalog = {
  cards: true,
  buttons: true,
  inputs: true,
  lists: true,
  sections: true,
  sheets: true,
  dialogs: true,
  badges: true,
  icons: true,
  loading: true,
  emptyStates: true,
  errorStates: true,
  skeletons: true,
  snackbars: true,
  bottomSheets: true,
}

export function shellTokenCssVariables(
  tokens: ShellDesignTokens = SHELL_DESIGN_TOKENS,
): Record<string, string> {
  return {
    '--shell-font-display': tokens.typography.fontFamilyDisplay,
    '--shell-font-body': tokens.typography.fontFamilyBody,
    '--shell-space-md': `${tokens.spacing.md}px`,
    '--shell-space-lg': `${tokens.spacing.lg}px`,
    '--shell-radius-md': `${tokens.radius.md}px`,
    '--shell-elevation-md': tokens.elevation.md,
  }
}

export const ShellDesignTokensApi = {
  tokens: SHELL_DESIGN_TOKENS,
  primitives: SHELL_PRIMITIVE_CATALOG,
  cssVars: shellTokenCssVariables,
}
