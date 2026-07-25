/**
 * Phase 4 Stage 1 — Premium Application Shell contracts.
 * Framework / navigation / design-system architecture only.
 * No booking, search, payment, maps, or AI logic.
 */

export type ShellLocale = 'ar' | 'en'
export type ShellDirection = 'rtl' | 'ltr'
export type ShellThemeMode = 'light' | 'dark' | 'system'
export type ShellBreakpoint = 'phone' | 'tablet' | 'desktop' | 'foldable'

/** Top-level application modules (independent navigation graphs). */
export type ShellModuleId =
  | 'home'
  | 'ai_conversation_center'
  | 'voice_center'
  | 'knowledge_center'
  | 'trips'
  | 'executive_trips'
  | 'notifications'
  | 'profile'
  | 'settings'
  /** Reserved — must remain independent from Chat / Knowledge / Voice. */
  | 'memory_center_future'

export type ShellNavPattern =
  | 'bottom_navigation'
  | 'side_drawer'
  | 'deep_link'
  | 'nested'
  | 'module_graph'

export interface ShellModuleDefinition {
  id: ShellModuleId
  titleKey: string
  path: string
  /** Bottom nav visibility (primary sections). */
  showInBottomNav: boolean
  /** Side drawer visibility. */
  showInDrawer: boolean
  /** Independent navigation graph id. */
  graphId: string
  /** Isolation rules — documented for architecture tests. */
  isolation: {
    notInsideChat: boolean
    ownsVoiceOnly: boolean
    ownsKnowledgeOnly: boolean
    ownsConversationHistoryOnly: boolean
  }
  enabledByDefault: boolean
}

export interface ShellRouteDefinition {
  id: string
  moduleId: ShellModuleId
  path: string
  parentPath: string | null
  deepLinkPattern: string
  requiresAuth: boolean
  titleKey: string
}

export interface ShellNavigationGraph {
  graphId: string
  moduleId: ShellModuleId
  rootPath: string
  routes: ShellRouteDefinition[]
}

export interface ShellDeepLink {
  pattern: string
  moduleId: ShellModuleId
  routeId: string
  example: string
}

export interface ShellNavGuardContext {
  isAuthenticated: boolean
  locale: ShellLocale
  themeMode: ShellThemeMode
  visibleModules: ShellModuleId[]
  featureShellEnabled: boolean
}

export interface ShellNavGuardResult {
  allowed: boolean
  redirectTo: string | null
  reason: string | null
}

export interface ShellDesignTokens {
  typography: {
    fontFamilyDisplay: string
    fontFamilyBody: string
    sizeXs: number
    sizeSm: number
    sizeMd: number
    sizeLg: number
    sizeXl: number
    size2xl: number
  }
  spacing: Record<'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl', number>
  radius: Record<'sm' | 'md' | 'lg' | 'xl' | 'pill', number>
  elevation: Record<'none' | 'sm' | 'md' | 'lg', string>
}

export interface ShellThemeTokens {
  mode: Exclude<ShellThemeMode, 'system'>
  colors: {
    background: string
    surface: string
    primary: string
    secondary: string
    text: string
    textMuted: string
    border: string
    danger: string
    success: string
    warning: string
  }
}

export interface ShellLocalizationState {
  locale: ShellLocale
  direction: ShellDirection
  /** Future multilingual readiness — catalogs are keys only. */
  catalogIds: string[]
}

export interface ShellUiState {
  navigation: {
    activeModuleId: ShellModuleId
    activePath: string
    drawerOpen: boolean
    bottomNavVisible: boolean
  }
  theme: {
    mode: ShellThemeMode
    resolved: Exclude<ShellThemeMode, 'system'>
  }
  localization: ShellLocalizationState
  auth: {
    isAuthenticated: boolean
    userId: string | null
  }
  modules: {
    visible: ShellModuleId[]
  }
  featureFlags: {
    applicationShell: boolean
  }
  breakpoint: ShellBreakpoint
}

export interface ShellPrimitiveCatalog {
  cards: true
  buttons: true
  inputs: true
  lists: true
  sections: true
  sheets: true
  dialogs: true
  badges: true
  icons: true
  loading: true
  emptyStates: true
  errorStates: true
  skeletons: true
  snackbars: true
  bottomSheets: true
}

export function directionForLocale(locale: ShellLocale): ShellDirection {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

export function resolveThemeMode(
  mode: ShellThemeMode,
  systemPrefersDark: boolean,
): Exclude<ShellThemeMode, 'system'> {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light'
  return mode
}

export function breakpointFromWidth(width: number): ShellBreakpoint {
  if (!Number.isFinite(width) || width <= 0) return 'phone'
  if (width < 600) return 'phone'
  if (width < 900) return 'foldable'
  if (width < 1200) return 'tablet'
  return 'desktop'
}
