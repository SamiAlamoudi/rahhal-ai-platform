/**
 * Phase 4 Stage 1 — Light / dark theme token sets + dynamic resolution.
 */

import type { ShellThemeMode, ShellThemeTokens } from '../types'
import { resolveThemeMode } from '../types'

export const SHELL_LIGHT_THEME: ShellThemeTokens = {
  mode: 'light',
  colors: {
    background: '#F7F5F2',
    surface: '#FFFFFF',
    primary: '#0F3D3E',
    secondary: '#C45C26',
    text: '#14212B',
    textMuted: '#5B6B76',
    border: '#E2E8F0',
    danger: '#B42318',
    success: '#027A48',
    warning: '#B54708',
  },
}

export const SHELL_DARK_THEME: ShellThemeTokens = {
  mode: 'dark',
  colors: {
    background: '#0B1220',
    surface: '#152033',
    primary: '#5EEAD4',
    secondary: '#FDBA74',
    text: '#E8EEF5',
    textMuted: '#94A3B8',
    border: '#243247',
    danger: '#F97066',
    success: '#6CE9A6',
    warning: '#FDB022',
  },
}

export function resolveShellThemeTokens(
  mode: ShellThemeMode,
  systemPrefersDark = false,
): ShellThemeTokens {
  const resolved = resolveThemeMode(mode, systemPrefersDark)
  return resolved === 'dark' ? SHELL_DARK_THEME : SHELL_LIGHT_THEME
}

export function shellThemeCssVariables(tokens: ShellThemeTokens): Record<string, string> {
  return {
    '--shell-color-bg': tokens.colors.background,
    '--shell-color-surface': tokens.colors.surface,
    '--shell-color-primary': tokens.colors.primary,
    '--shell-color-secondary': tokens.colors.secondary,
    '--shell-color-text': tokens.colors.text,
    '--shell-color-text-muted': tokens.colors.textMuted,
    '--shell-color-border': tokens.colors.border,
  }
}

export const ShellThemeTokensApi = {
  light: SHELL_LIGHT_THEME,
  dark: SHELL_DARK_THEME,
  resolve: resolveShellThemeTokens,
  cssVars: shellThemeCssVariables,
}
