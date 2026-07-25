/**
 * Phase 4 Stage 1 — Premium Application Shell barrel.
 *
 * Isolated framework package. Not wired into production main.tsx routes.
 * Gated by `ui.application_shell` (default OFF).
 */

export {
  APPLICATION_SHELL_FEATURE_ID,
  isApplicationShellEnabled,
  ApplicationShellRegistry,
} from './applicationShellRegistry'

export type {
  ShellLocale,
  ShellDirection,
  ShellThemeMode,
  ShellBreakpoint,
  ShellModuleId,
  ShellNavPattern,
  ShellModuleDefinition,
  ShellRouteDefinition,
  ShellNavigationGraph,
  ShellDeepLink,
  ShellNavGuardContext,
  ShellNavGuardResult,
  ShellDesignTokens,
  ShellThemeTokens,
  ShellLocalizationState,
  ShellUiState,
  ShellPrimitiveCatalog,
} from './types'

export {
  directionForLocale,
  resolveThemeMode,
  breakpointFromWidth,
} from './types'

export * from './modules'
export * from './navigation'
export * from './designSystem'
export * from './theme'
export * from './localization'
export * from './state'
export * from './layout'

/** Architecture inventory for docs / tests. */
export const APPLICATION_SHELL_ARCHITECTURE = {
  version: '4.1.0-application-shell',
  featureId: 'ui.application_shell' as const,
  wiredIntoProductionRoutes: false,
  modules: [
    'home',
    'ai_conversation_center',
    'voice_center',
    'knowledge_center',
    'trips',
    'executive_trips',
    'notifications',
    'profile',
    'settings',
    'memory_center_future',
  ] as const,
  navPatterns: [
    'bottom_navigation',
    'side_drawer',
    'deep_link',
    'nested',
    'module_graph',
    'guards',
  ] as const,
} as const
