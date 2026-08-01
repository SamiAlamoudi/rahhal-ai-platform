/**
 * Sprint 83 — Dependency graph scheduler.
 * Builds parallel batches from selected agents + declared dependsOn.
 * Never hardcodes a global execution order.
 */

import type { BrainAgentDefinition, BrainAgentId } from './types'

export class DependencyGraph {
  /**
   * Produce parallel-ready batches (levels) for selected agents.
   * Soft deps: only wait on dependencies that are also selected.
   */
  buildBatches(
    selected: BrainAgentId[],
    definitions: Map<BrainAgentId, BrainAgentDefinition>,
  ): BrainAgentId[][] {
    const selectedSet = new Set(selected)
    const indegree = new Map<BrainAgentId, number>()
    const dependents = new Map<BrainAgentId, BrainAgentId[]>()

    for (const id of selected) {
      indegree.set(id, 0)
      dependents.set(id, [])
    }

    for (const id of selected) {
      const def = definitions.get(id)
      if (!def) continue
      const activeDeps = def.dependsOn.filter((d) => selectedSet.has(d))
      indegree.set(id, activeDeps.length)
      for (const dep of activeDeps) {
        dependents.get(dep)?.push(id)
      }
    }

    const batches: BrainAgentId[][] = []
    const remaining = new Set(selected)

    while (remaining.size > 0) {
      const ready = [...remaining].filter((id) => (indegree.get(id) ?? 0) === 0)
      if (ready.length === 0) {
        // Cycle / unresolved — flush remaining sequentially to avoid deadlock.
        batches.push([...remaining])
        break
      }

      // Prefer keeping parallelCompatibleWith agents in the same batch.
      const batch = this.groupParallel(ready, definitions)
      batches.push(batch)

      for (const id of batch) {
        remaining.delete(id)
        for (const child of dependents.get(id) ?? []) {
          indegree.set(child, Math.max(0, (indegree.get(child) ?? 0) - 1))
        }
      }
    }

    return batches
  }

  private groupParallel(
    ready: BrainAgentId[],
    definitions: Map<BrainAgentId, BrainAgentDefinition>,
  ): BrainAgentId[] {
    if (ready.length <= 1) return ready

    // Start with agents that explicitly list each other as parallel-compatible.
    const batch: BrainAgentId[] = []
    const leftover: BrainAgentId[] = []

    for (const id of ready) {
      const def = definitions.get(id)
      if (!def) {
        leftover.push(id)
        continue
      }
      if (batch.length === 0) {
        batch.push(id)
        continue
      }
      const compatible = batch.every((other) => {
        const otherDef = definitions.get(other)
        if (!otherDef) return false
        return (
          def.parallelCompatibleWith.includes(other)
          || otherDef.parallelCompatibleWith.includes(id)
          || (def.dependsOn.length === 0 && otherDef.dependsOn.length === 0)
        )
      })
      if (compatible) batch.push(id)
      else leftover.push(id)
    }

    // Agents with zero mutual compatibility still share a ready-level batch
    // when the graph says they are concurrently runnable (true parallelism).
    return [...batch, ...leftover]
  }

  /** Flat execution order derived from batches (for telemetry). */
  flatten(batches: BrainAgentId[][]): BrainAgentId[] {
    return batches.flat()
  }
}

export function createDependencyGraph(): DependencyGraph {
  return new DependencyGraph()
}
