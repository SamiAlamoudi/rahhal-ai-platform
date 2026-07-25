/**
 * Phase 6 — RecoveryManager
 * Tool failure → fallback; missing info → estimates; low confidence → clarify.
 */

import type {
  AgentToolId,
  MissionTask,
  RecoveryAction,
  ToolRouteDecision,
  TravelGoal,
} from './types'

export function planRecovery(input: {
  toolDecision: ToolRouteDecision
  goal: TravelGoal
  failedTool?: AgentToolId | null
  missingCritical?: boolean
  confidenceLow?: boolean
  currentTask?: MissionTask | null
}): RecoveryAction[] {
  const actions: RecoveryAction[] = []

  if (input.failedTool) {
    const fallback = input.toolDecision.fallbackTools[0]
    if (fallback && fallback !== 'none') {
      actions.push({
        kind: 'use_fallback_tool',
        detail: `${input.failedTool} failed — try ${fallback}`,
        tool: fallback,
      })
    } else {
      actions.push({
        kind: 'retry_tool',
        detail: `Retry ${input.failedTool} once`,
        tool: input.failedTool,
      })
    }
    actions.push({
      kind: 'continue_with_estimate',
      detail: 'Continue mission with estimates while tool recovers',
    })
  }

  if (input.missingCritical) {
    actions.push({
      kind: 'continue_with_estimate',
      detail: 'Missing fields — continue with consultant estimates',
    })
    if (input.currentTask?.unblockQuestion) {
      actions.push({
        kind: 'ask_clarification',
        detail: input.currentTask.unblockQuestion,
      })
    }
  }

  if (input.confidenceLow) {
    actions.push({
      kind: 'ask_clarification',
      detail: input.currentTask?.unblockQuestion
        ?? 'Which matters more right now: dates, budget, or destination vibe?',
    })
  }

  if (!input.goal.destination && !input.confidenceLow) {
    actions.push({
      kind: 'ask_clarification',
      detail: 'Destination still open — one vibe question unblocks planning',
    })
  }

  return actions.slice(0, 3)
}

export function detectConflicts(goal: TravelGoal): string[] {
  const conflicts: string[] = []
  if (goal.durationDays != null && goal.durationDays <= 2 && goal.destination === 'Japan') {
    conflicts.push('Very short Japan trip — multi-city unrealistic')
  }
  if (goal.purpose === 'honeymoon' && goal.notes.includes('companion_unavailable')) {
    conflicts.push('Honeymoon purpose conflicts with solo traveler update')
  }
  if (goal.budgetAmount != null && goal.budgetAmount < 3000 && goal.destination === 'Japan') {
    conflicts.push('Budget may be tight for Japan honeymoon — use estimates carefully')
  }
  return conflicts
}

export const RecoveryManager = {
  plan: planRecovery,
  detectConflicts,
}
