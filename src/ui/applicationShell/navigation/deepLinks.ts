/**
 * Phase 4 Stage 1 — Deep link patterns for shell modules.
 */

import type { ShellDeepLink, ShellModuleId } from '../types'
import { SHELL_ROUTES } from './routes'

export const SHELL_DEEP_LINKS: readonly ShellDeepLink[] = SHELL_ROUTES.map((r) => ({
  pattern: r.deepLinkPattern,
  moduleId: r.moduleId,
  routeId: r.id,
  example: r.path.includes(':')
    ? r.path.replace(':conversationId', 'demo').replace(':sessionId', 'demo').replace(':tripId', 'demo')
    : r.path,
}))

export function resolveDeepLink(path: string): ShellDeepLink | null {
  for (const link of SHELL_DEEP_LINKS) {
    const pattern = link.pattern.replace(/\*/g, '[^/]+')
    if (new RegExp(`^${pattern}$`).test(path)) return link
  }
  return null
}

export function deepLinksForModule(moduleId: ShellModuleId): ShellDeepLink[] {
  return SHELL_DEEP_LINKS.filter((l) => l.moduleId === moduleId)
}

export const ShellDeepLinks = {
  all: SHELL_DEEP_LINKS,
  resolve: resolveDeepLink,
  forModule: deepLinksForModule,
}
