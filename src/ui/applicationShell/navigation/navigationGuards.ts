/**
 * Phase 4 Stage 1 — Navigation guards (architecture only).
 */

import { isApplicationShellEnabled } from '../applicationShellRegistry'
import { getShellModule } from '../modules/moduleRegistry'
import type { ShellNavGuardContext, ShellNavGuardResult, ShellModuleId } from '../types'
import { findShellRouteByPath } from './routes'

export function createDefaultGuardContext(
  overrides?: Partial<ShellNavGuardContext>,
): ShellNavGuardContext {
  return {
    isAuthenticated: false,
    locale: 'ar',
    themeMode: 'system',
    visibleModules: [
      'home',
      'ai_conversation_center',
      'voice_center',
      'knowledge_center',
      'trips',
      'executive_trips',
      'notifications',
      'profile',
      'settings',
    ],
    featureShellEnabled: isApplicationShellEnabled(),
    ...overrides,
  }
}

export function canActivateShellPath(
  path: string,
  context: ShellNavGuardContext,
): ShellNavGuardResult {
  if (!context.featureShellEnabled) {
    return {
      allowed: false,
      redirectTo: null,
      reason: 'application_shell_disabled',
    }
  }

  const route = findShellRouteByPath(path)
  if (!route) {
    return { allowed: false, redirectTo: '/shell/home', reason: 'unknown_route' }
  }

  if (!context.visibleModules.includes(route.moduleId)) {
    return {
      allowed: false,
      redirectTo: '/shell/home',
      reason: 'module_hidden',
    }
  }

  const mod = getShellModule(route.moduleId)
  if (!mod?.enabledByDefault && route.moduleId === 'memory_center_future') {
    return {
      allowed: false,
      redirectTo: '/shell/home',
      reason: 'future_module_not_enabled',
    }
  }

  if (route.requiresAuth && !context.isAuthenticated) {
    return {
      allowed: false,
      redirectTo: '/login',
      reason: 'auth_required',
    }
  }

  return { allowed: true, redirectTo: null, reason: null }
}

export function canOpenModule(
  moduleId: ShellModuleId,
  context: ShellNavGuardContext,
): boolean {
  if (!context.featureShellEnabled) return false
  if (!context.visibleModules.includes(moduleId)) return false
  const mod = getShellModule(moduleId)
  if (!mod) return false
  if (moduleId === 'memory_center_future' && !mod.enabledByDefault) return false
  return true
}

export const ShellNavigationGuards = {
  createContext: createDefaultGuardContext,
  canActivate: canActivateShellPath,
  canOpenModule,
}
