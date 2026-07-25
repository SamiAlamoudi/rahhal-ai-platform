/**
 * Phase 4 Stage 1 — Scalable UI state architecture (in-memory foundation).
 */

import { isApplicationShellEnabled } from '../applicationShellRegistry'
import { listBottomNavModules, listDrawerModules } from '../modules/moduleRegistry'
import { createLocalizationState } from '../localization/localizationState'
import type {
  ShellBreakpoint,
  ShellModuleId,
  ShellThemeMode,
  ShellUiState,
} from '../types'
import { breakpointFromWidth, resolveThemeMode } from '../types'

export function createInitialShellState(options?: {
  locale?: 'ar' | 'en'
  themeMode?: ShellThemeMode
  isAuthenticated?: boolean
  width?: number
  enabled?: boolean
}): ShellUiState {
  const themeMode = options?.themeMode ?? 'system'
  return {
    navigation: {
      activeModuleId: 'home',
      activePath: '/shell/home',
      drawerOpen: false,
      bottomNavVisible: true,
    },
    theme: {
      mode: themeMode,
      resolved: resolveThemeMode(themeMode, false),
    },
    localization: createLocalizationState(options?.locale ?? 'ar'),
    auth: {
      isAuthenticated: options?.isAuthenticated ?? false,
      userId: null,
    },
    modules: {
      visible: [
        ...new Set([
          ...listBottomNavModules().map((m) => m.id),
          ...listDrawerModules().map((m) => m.id),
        ]),
      ],
    },
    featureFlags: {
      applicationShell: isApplicationShellEnabled({ enabled: options?.enabled }),
    },
    breakpoint: breakpointFromWidth(options?.width ?? 390),
  }
}

export function setActiveShellModule(
  state: ShellUiState,
  moduleId: ShellModuleId,
  path: string,
): ShellUiState {
  return {
    ...state,
    navigation: {
      ...state.navigation,
      activeModuleId: moduleId,
      activePath: path,
      drawerOpen: false,
    },
  }
}

export function setShellDrawerOpen(state: ShellUiState, open: boolean): ShellUiState {
  return {
    ...state,
    navigation: { ...state.navigation, drawerOpen: open },
  }
}

export function setShellThemeMode(
  state: ShellUiState,
  mode: ShellThemeMode,
  systemPrefersDark = false,
): ShellUiState {
  return {
    ...state,
    theme: {
      mode,
      resolved: resolveThemeMode(mode, systemPrefersDark),
    },
  }
}

export function setShellBreakpoint(
  state: ShellUiState,
  width: number,
): ShellUiState {
  const breakpoint: ShellBreakpoint = breakpointFromWidth(width)
  return {
    ...state,
    breakpoint,
    navigation: {
      ...state.navigation,
      // Desktop prefers drawer; phone prefers bottom nav.
      bottomNavVisible: breakpoint === 'phone' || breakpoint === 'foldable',
      drawerOpen: breakpoint === 'desktop' ? state.navigation.drawerOpen : false,
    },
  }
}

export function setShellAuth(
  state: ShellUiState,
  auth: { isAuthenticated: boolean; userId: string | null },
): ShellUiState {
  return { ...state, auth: { ...auth } }
}

export const ShellState = {
  create: createInitialShellState,
  setActiveModule: setActiveShellModule,
  setDrawerOpen: setShellDrawerOpen,
  setThemeMode: setShellThemeMode,
  setBreakpoint: setShellBreakpoint,
  setAuth: setShellAuth,
}
