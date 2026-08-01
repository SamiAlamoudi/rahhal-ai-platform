/**
 * Sprint 85 — Dependency resolution for tool decisions.
 * Booking waits for flights, hotels, pricing (+ validation via safety).
 */

import type { ExecutableToolType, ToolDecision } from './types'

const DEFAULT_DEPS: Partial<Record<ExecutableToolType, ExecutableToolType[]>> = {
  pricing: ['flights', 'hotels', 'packages'],
  booking: ['flights', 'hotels', 'pricing'],
}

const PARALLEL_CONTEXT: ExecutableToolType[] = [
  'weather',
  'maps',
  'visa',
  'currency',
]

export class DependencyResolver {
  /** Enrich decisions with default dependency edges when missing. */
  enrich(decisions: ToolDecision[]): ToolDecision[] {
    const selected = new Set(decisions.map((d) => d.tool))
    return decisions.map((d) => {
      const defaults = (DEFAULT_DEPS[d.tool] ?? []).filter((dep) => selected.has(dep))
      const dependsOn = [...new Set([...(d.dependsOn ?? []), ...defaults])]
      return { ...d, dependsOn, params: { ...d.params } }
    })
  }

  /**
   * Build parallel-ready batches from dependencies.
   * Soft deps: only wait on dependencies that are also selected.
   */
  buildBatches(decisions: ToolDecision[]): ExecutableToolType[][] {
    const enriched = this.enrich(decisions)
    const selected = enriched.map((d) => d.tool)
    const selectedSet = new Set(selected)
    const indegree = new Map<ExecutableToolType, number>()
    const children = new Map<ExecutableToolType, ExecutableToolType[]>()

    for (const tool of selected) {
      indegree.set(tool, 0)
      children.set(tool, [])
    }

    for (const d of enriched) {
      const deps = (d.dependsOn ?? []).filter((x) => selectedSet.has(x))
      indegree.set(d.tool, deps.length)
      for (const dep of deps) {
        children.get(dep)?.push(d.tool)
      }
    }

    const batches: ExecutableToolType[][] = []
    const remaining = new Set(selected)

    while (remaining.size > 0) {
      const ready = [...remaining].filter((t) => (indegree.get(t) ?? 0) === 0)
      if (ready.length === 0) {
        batches.push([...remaining])
        break
      }

      // Prefer keeping weather/maps/visa/currency together when co-ready.
      const contextReady = ready.filter((t) => PARALLEL_CONTEXT.includes(t))
      const batch =
        contextReady.length >= 2
          ? [...contextReady, ...ready.filter((t) => !PARALLEL_CONTEXT.includes(t))]
          : ready

      batches.push(batch)
      for (const tool of batch) {
        remaining.delete(tool)
        for (const child of children.get(tool) ?? []) {
          indegree.set(child, Math.max(0, (indegree.get(child) ?? 0) - 1))
        }
      }
    }

    return batches
  }
}

export function createDependencyResolver(): DependencyResolver {
  return new DependencyResolver()
}
