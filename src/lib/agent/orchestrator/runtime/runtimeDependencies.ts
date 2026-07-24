/**
 * Phase 2 Stage 4 — Runtime dependency graph.
 * Declares edges only; no engine logic.
 */

import type { RuntimeStageId } from './runtimeTypes'
import { RUNTIME_STAGE_ORDER } from './runtimeTypes'

/** Depends-on edges: stage → prerequisites that must succeed or be cached. */
export const RUNTIME_DEPENDENCIES: Readonly<
  Record<RuntimeStageId, readonly RuntimeStageId[]>
> = {
  reflection: [],
  traveler_intelligence: [],
  planning_graph: ['reflection', 'traveler_intelligence'],
  destination_intelligence: ['traveler_intelligence'],
  recommendation_intelligence: [
    'planning_graph',
    'traveler_intelligence',
    'destination_intelligence',
  ],
  travel_strategy: ['destination_intelligence', 'traveler_intelligence'],
  unified_consultant_response: [
    'traveler_intelligence',
    'destination_intelligence',
    'travel_strategy',
    'recommendation_intelligence',
    'reflection',
    'planning_graph',
  ],
}

/**
 * Resolve execution order for requested stages (stable topological sort).
 * Unknown / cyclic edges are ignored; falls back to RUNTIME_STAGE_ORDER filter.
 */
export function resolveRuntimeExecutionOrder(
  requested: readonly RuntimeStageId[],
): RuntimeStageId[] {
  const want = new Set(requested)
  // Expand prerequisites so dependents can run.
  const expanded = new Set<RuntimeStageId>()
  const visit = (id: RuntimeStageId) => {
    if (expanded.has(id)) return
    for (const dep of RUNTIME_DEPENDENCIES[id] ?? []) visit(dep)
    expanded.add(id)
  }
  for (const id of requested) visit(id)

  const order: RuntimeStageId[] = []
  for (const id of RUNTIME_STAGE_ORDER) {
    if (expanded.has(id) && (want.has(id) || isPrerequisiteOfWanted(id, want))) {
      order.push(id)
    }
  }
  // Ensure every wanted stage appears even if not in canonical list (shouldn't happen).
  for (const id of requested) {
    if (!order.includes(id)) order.push(id)
  }
  return order
}

function isPrerequisiteOfWanted(
  id: RuntimeStageId,
  want: Set<RuntimeStageId>,
): boolean {
  for (const w of want) {
    if ((RUNTIME_DEPENDENCIES[w] ?? []).includes(id)) return true
    // transitive
    const stack = [...(RUNTIME_DEPENDENCIES[w] ?? [])]
    const seen = new Set<RuntimeStageId>()
    while (stack.length) {
      const cur = stack.pop()!
      if (seen.has(cur)) continue
      seen.add(cur)
      if (cur === id) return true
      stack.push(...(RUNTIME_DEPENDENCIES[cur] ?? []))
    }
  }
  return false
}

/** Stages that depend (transitively) on `failed`. */
export function dependentsOf(failed: RuntimeStageId): RuntimeStageId[] {
  const out: RuntimeStageId[] = []
  for (const id of RUNTIME_STAGE_ORDER) {
    if (id === failed) continue
    const stack = [...(RUNTIME_DEPENDENCIES[id] ?? [])]
    const seen = new Set<RuntimeStageId>()
    while (stack.length) {
      const cur = stack.pop()!
      if (seen.has(cur)) continue
      seen.add(cur)
      if (cur === failed) {
        out.push(id)
        break
      }
      stack.push(...(RUNTIME_DEPENDENCIES[cur] ?? []))
    }
  }
  return out
}

export const RuntimeDependencies = {
  graph: RUNTIME_DEPENDENCIES,
  resolveOrder: resolveRuntimeExecutionOrder,
  dependentsOf,
}
