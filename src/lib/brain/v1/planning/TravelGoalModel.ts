/**
 * Sprint 84 — Travel Goal Model.
 */

import type { BrainV1Intent } from '../types'
import type { TravelGoal, TravelGoalPriority, TravelGoalStatus } from './types'

function now(): string {
  return new Date().toISOString()
}

export class TravelGoalModel {
  create(input: {
    intent: BrainV1Intent
    destination?: string | null
    priority?: TravelGoalPriority
    confidence?: number
    status?: TravelGoalStatus
  }): TravelGoal {
    const ts = now()
    const destination = input.destination?.trim() || null
    const label = destination
      ? `Travel to ${destination}`
      : intentLabel(input.intent)

    return {
      goalId: `goal_${ts.replace(/[^0-9]/g, '').slice(0, 14)}_${Math.random().toString(36).slice(2, 7)}`,
      intent: input.intent,
      label,
      priority: input.priority ?? 'normal',
      status: input.status ?? 'draft',
      createdAt: ts,
      updatedAt: ts,
      confidence: input.confidence ?? 0.5,
    }
  }

  update(
    goal: TravelGoal,
    patch: Partial<Pick<TravelGoal, 'intent' | 'label' | 'priority' | 'status' | 'confidence'>>,
  ): TravelGoal {
    const next: TravelGoal = {
      ...goal,
      ...patch,
      updatedAt: now(),
    }
    return next
  }

  refreshLabel(goal: TravelGoal, destination: string | null): TravelGoal {
    if (!destination) return this.update(goal, {})
    return this.update(goal, { label: `Travel to ${destination}` })
  }
}

function intentLabel(intent: BrainV1Intent): string {
  switch (intent) {
    case 'flight_search':
      return 'Find flights'
    case 'hotel_search':
      return 'Find hotels'
    case 'package_search':
      return 'Plan a package trip'
    case 'visa_question':
      return 'Answer visa question'
    case 'travel_advice':
      return 'Provide travel advice'
    default:
      return 'Plan a trip'
  }
}

export function createTravelGoalModel(): TravelGoalModel {
  return new TravelGoalModel()
}
