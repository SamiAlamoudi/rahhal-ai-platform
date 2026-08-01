/**
 * Sprint 82 — ToolDecisionEngine (Brain v1).
 * Decides tools automatically via ToolRegistry — never hardcodes provider choice.
 */

import { createToolRegistry, type ToolRegistry } from './ToolRegistry'
import type { BrainV1Intent, BrainV1MissingField, BrainV1ToolId } from './types'

export class ToolDecisionEngine {
  private readonly registry: ToolRegistry

  constructor(registry?: ToolRegistry) {
    this.registry = registry ?? createToolRegistry()
  }

  getRegistry(): ToolRegistry {
    return this.registry
  }

  select(intent: BrainV1Intent, missing: BrainV1MissingField[]): BrainV1ToolId[] {
    if (intent === 'cancellation' || intent === 'unknown') return ['none']

    const needsTripTools = this.registry.list().some(
      (def) => def.requiresCompleteTrip && def.intents.includes(intent),
    )
    if (needsTripTools && missing.length > 0) return ['none']

    return this.registry.resolveForIntent(intent, {
      complete: !needsTripTools || missing.length === 0,
      includeSecondary: missing.length === 0,
    })
  }
}

export function createToolDecisionEngine(registry?: ToolRegistry): ToolDecisionEngine {
  return new ToolDecisionEngine(registry)
}
