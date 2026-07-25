/**
 * Phase 4 Stage 1 — Independent navigation graphs per module.
 */

import { SHELL_MODULES } from '../modules/moduleRegistry'
import type { ShellModuleId, ShellNavigationGraph } from '../types'
import { routesForModule } from './routes'

export function buildShellNavigationGraphs(): ShellNavigationGraph[] {
  return SHELL_MODULES.map((mod) => ({
    graphId: mod.graphId,
    moduleId: mod.id,
    rootPath: mod.path,
    routes: routesForModule(mod.id),
  }))
}

export function getShellNavigationGraph(
  moduleId: ShellModuleId,
): ShellNavigationGraph | null {
  return buildShellNavigationGraphs().find((g) => g.moduleId === moduleId) ?? null
}

/** Nested children for a route path. */
export function nestedRoutes(parentPath: string) {
  return buildShellNavigationGraphs()
    .flatMap((g) => g.routes)
    .filter((r) => r.parentPath === parentPath)
}

export const ShellNavigationGraphApi = {
  buildAll: buildShellNavigationGraphs,
  get: getShellNavigationGraph,
  nested: nestedRoutes,
}
