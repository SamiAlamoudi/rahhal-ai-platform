/**
 * Goal Engine — keeps a long-running travel objective across turns until completed.
 */

import type { AgentMemory, TripRequirements } from '../types'
import type { AutonomousGoal, AutonomousGoalStatus } from './types'

export function createGoalId(conversationId: string, objective: string): string {
  const slug = objective.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-').slice(0, 48)
  return `goal:${conversationId}:${slug || 'travel'}`
}

export function deriveTravelObjective(input: {
  userText: string
  requirements: TripRequirements
  priorGoal?: AutonomousGoal | null
}): string {
  const dest = input.requirements.destination
    || input.requirements.destinations[0]
    || null
  if (dest) return `plan_trip:${dest}`
  if (input.requirements.destinationFlexible) return 'discover_destination'
  if (/book|حجز|reserve/i.test(input.userText)) return 'book_trip'
  if (input.priorGoal?.status === 'active') return input.priorGoal.objective
  return 'plan_trip'
}

export function describeGoal(objective: string, requirements: TripRequirements, locale: 'ar' | 'en'): string {
  const dest = requirements.destination || requirements.destinations[0]
  if (objective.startsWith('plan_trip:') && dest) {
    return locale === 'ar' ? `تخطيط رحلة إلى ${dest}` : `Plan a trip to ${dest}`
  }
  if (objective === 'discover_destination') {
    return locale === 'ar' ? 'اكتشاف وجهة مناسبة' : 'Discover a fitting destination'
  }
  if (objective === 'book_trip') {
    return locale === 'ar' ? 'إتمام الحجز' : 'Complete booking'
  }
  return locale === 'ar' ? 'تخطيط رحلة' : 'Plan a trip'
}

/**
 * Critical hard slots that truly block autonomous tool execution.
 * Soft preferences are never blocking — agent continues without asking.
 */
export function criticalBlockingFields(
  requirements: TripRequirements,
  missingFields: Array<keyof TripRequirements>,
): string[] {
  const critical = new Set(['destination', 'durationDays', 'budgetAmount', 'travelers'])
  // Flexible destination is enough to run discovery without a fixed city.
  if (requirements.destinationFlexible) critical.delete('destination')
  return missingFields.filter((f) => critical.has(String(f))).map(String)
}

export function upsertTravelGoal(input: {
  conversationId: string
  userText: string
  memory: AgentMemory
  priorGoal?: AutonomousGoal | null
  now?: Date
}): AutonomousGoal {
  const now = (input.now ?? new Date()).toISOString()
  const objective = deriveTravelObjective({
    userText: input.userText,
    requirements: input.memory.requirements,
    priorGoal: input.priorGoal,
  })
  const blockingFields = criticalBlockingFields(
    input.memory.requirements,
    input.memory.missingFields,
  )

  if (
    input.priorGoal
    && input.priorGoal.conversationId === input.conversationId
    && input.priorGoal.status === 'active'
    && (input.priorGoal.objective === objective
      || objective.startsWith('plan_trip:')
      || input.priorGoal.objective.startsWith('plan_trip:'))
  ) {
    const mergedObjective = objective.startsWith('plan_trip:')
      ? objective
      : input.priorGoal.objective
    return {
      ...input.priorGoal,
      objective: mergedObjective,
      description: describeGoal(mergedObjective, input.memory.requirements, input.memory.locale),
      blockingFields,
      status: blockingFields.length > 0 ? 'blocked' : 'active',
      updatedAt: now,
    }
  }

  return {
    id: createGoalId(input.conversationId, objective),
    conversationId: input.conversationId,
    objective,
    description: describeGoal(objective, input.memory.requirements, input.memory.locale),
    status: blockingFields.length > 0 ? 'blocked' : 'active',
    createdAt: now,
    updatedAt: now,
    blockingFields,
  }
}

export function completeGoal(goal: AutonomousGoal, now = new Date()): AutonomousGoal {
  return {
    ...goal,
    status: 'completed',
    blockingFields: [],
    updatedAt: now.toISOString(),
  }
}

export function failGoal(goal: AutonomousGoal, now = new Date()): AutonomousGoal {
  return {
    ...goal,
    status: 'failed',
    updatedAt: now.toISOString(),
  }
}

export function markGoalStatus(goal: AutonomousGoal, status: AutonomousGoalStatus, now = new Date()): AutonomousGoal {
  return {
    ...goal,
    status,
    updatedAt: now.toISOString(),
  }
}

/** Restore prior goal from assistant provider meta when present. */
export function goalFromMeta(meta: unknown): AutonomousGoal | null {
  if (!meta || typeof meta !== 'object') return null
  const autonomous = (meta as { autonomous?: { goal?: AutonomousGoal | null } }).autonomous
  const goal = autonomous?.goal
  if (!goal || typeof goal !== 'object') return null
  if (typeof goal.id !== 'string' || typeof goal.objective !== 'string') return null
  return goal
}
