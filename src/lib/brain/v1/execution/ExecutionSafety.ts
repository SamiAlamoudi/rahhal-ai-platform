/**
 * Sprint 85 — Execution Safety.
 * Validates required slots, tool availability, rate limits, permissions, feature flags.
 */

import { isBrainV1Enabled } from '../feature'
import type { TravelPlanSlots } from '../planning/types'
import type { ExecutableToolType, ToolDecision } from './types'

export interface SafetyBlock {
  tool: ExecutableToolType
  reason: string
}

const TRIP_TOOLS: ExecutableToolType[] = [
  'flights',
  'hotels',
  'packages',
  'pricing',
  'booking',
]

export class ExecutionSafety {
  validateFeatureFlag(enabledOverride?: boolean): SafetyBlock | null {
    if (!isBrainV1Enabled({ enabled: enabledOverride })) {
      return { tool: 'knowledge', reason: 'ai.brain.v1 disabled' }
    }
    return null
  }

  validateDecision(
    decision: ToolDecision,
    slots: TravelPlanSlots | null,
    options?: {
      availableTools?: ExecutableToolType[]
      permissions?: Partial<Record<ExecutableToolType, boolean>>
      rateLimits?: Partial<Record<ExecutableToolType, number>>
      callCounts?: Partial<Record<ExecutableToolType, number>>
    },
  ): SafetyBlock | null {
    if (decision.when === false) {
      return { tool: decision.tool, reason: 'conditional_skip' }
    }

    if (
      options?.availableTools
      && !options.availableTools.includes(decision.tool)
    ) {
      return { tool: decision.tool, reason: 'tool_unavailable' }
    }

    if (options?.permissions && options.permissions[decision.tool] === false) {
      return { tool: decision.tool, reason: 'permission_denied' }
    }

    const limit = options?.rateLimits?.[decision.tool]
    if (limit != null) {
      const used = options?.callCounts?.[decision.tool] ?? 0
      if (used >= limit) {
        return { tool: decision.tool, reason: 'rate_limit_exceeded' }
      }
    }

    if (TRIP_TOOLS.includes(decision.tool)) {
      if (!slots?.destination) {
        return { tool: decision.tool, reason: 'missing_required_slot:destination' }
      }
      if (!slots.dates.start && !slots.flexibleDates) {
        return { tool: decision.tool, reason: 'missing_required_slot:dates' }
      }
    }

    if (decision.tool === 'booking') {
      // Booking tool is stub-only; still require core slots for safety.
      if (slots?.adults == null) {
        return { tool: decision.tool, reason: 'missing_required_slot:adults' }
      }
    }

    return null
  }
}

export function createExecutionSafety(): ExecutionSafety {
  return new ExecutionSafety()
}
