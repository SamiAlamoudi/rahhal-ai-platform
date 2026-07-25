/**
 * Phase 4 Stage 1 — Shell route catalog (architecture only; not mounted in main.tsx).
 */

import type { ShellModuleId, ShellRouteDefinition } from '../types'

function route(
  moduleId: ShellModuleId,
  id: string,
  path: string,
  titleKey: string,
  options?: { parentPath?: string | null; requiresAuth?: boolean },
): ShellRouteDefinition {
  return {
    id,
    moduleId,
    path,
    parentPath: options?.parentPath ?? null,
    deepLinkPattern: path.replace(/:\w+/g, '*'),
    requiresAuth: options?.requiresAuth ?? true,
    titleKey,
  }
}

export const SHELL_ROUTES: readonly ShellRouteDefinition[] = [
  route('home', 'home.root', '/shell/home', 'shell.route.home'),
  route('ai_conversation_center', 'conversation.root', '/shell/conversation', 'shell.route.conversation'),
  route(
    'ai_conversation_center',
    'conversation.thread',
    '/shell/conversation/:conversationId',
    'shell.route.conversation_thread',
    { parentPath: '/shell/conversation' },
  ),
  route('voice_center', 'voice.root', '/shell/voice', 'shell.route.voice'),
  route(
    'voice_center',
    'voice.session',
    '/shell/voice/session/:sessionId',
    'shell.route.voice_session',
    { parentPath: '/shell/voice' },
  ),
  route('knowledge_center', 'knowledge.root', '/shell/knowledge', 'shell.route.knowledge'),
  route(
    'knowledge_center',
    'knowledge.books',
    '/shell/knowledge/books',
    'shell.route.knowledge_books',
    { parentPath: '/shell/knowledge' },
  ),
  route(
    'knowledge_center',
    'knowledge.pdfs',
    '/shell/knowledge/pdfs',
    'shell.route.knowledge_pdfs',
    { parentPath: '/shell/knowledge' },
  ),
  route(
    'knowledge_center',
    'knowledge.guides',
    '/shell/knowledge/guides',
    'shell.route.knowledge_guides',
    { parentPath: '/shell/knowledge' },
  ),
  route(
    'knowledge_center',
    'knowledge.visa',
    '/shell/knowledge/visa',
    'shell.route.knowledge_visa',
    { parentPath: '/shell/knowledge' },
  ),
  route('trips', 'trips.root', '/shell/trips', 'shell.route.trips'),
  route(
    'trips',
    'trips.detail',
    '/shell/trips/:tripId',
    'shell.route.trip_detail',
    { parentPath: '/shell/trips' },
  ),
  route('executive_trips', 'executive.root', '/shell/executive-trips', 'shell.route.executive_trips'),
  route('notifications', 'notifications.root', '/shell/notifications', 'shell.route.notifications'),
  route('profile', 'profile.root', '/shell/profile', 'shell.route.profile'),
  route('settings', 'settings.root', '/shell/settings', 'shell.route.settings'),
  route(
    'settings',
    'settings.theme',
    '/shell/settings/theme',
    'shell.route.settings_theme',
    { parentPath: '/shell/settings' },
  ),
  route(
    'settings',
    'settings.locale',
    '/shell/settings/locale',
    'shell.route.settings_locale',
    { parentPath: '/shell/settings' },
  ),
  route('memory_center_future', 'memory.root', '/shell/memory', 'shell.route.memory_future'),
] as const

export function routesForModule(moduleId: ShellModuleId): ShellRouteDefinition[] {
  return SHELL_ROUTES.filter((r) => r.moduleId === moduleId)
}

export function findShellRouteByPath(path: string): ShellRouteDefinition | null {
  const exact = SHELL_ROUTES.find((r) => r.path === path)
  if (exact) return exact
  // Simple param match: /shell/trips/abc → trips.detail
  for (const r of SHELL_ROUTES) {
    if (!r.path.includes(':')) continue
    const pattern = r.path.replace(/:[^/]+/g, '[^/]+')
    if (new RegExp(`^${pattern}$`).test(path)) return r
  }
  return null
}

export const ShellRoutes = {
  all: SHELL_ROUTES,
  forModule: routesForModule,
  findByPath: findShellRouteByPath,
}
