/**
 * Sprint 82 — ConversationPlanner (Brain v1).
 * Tracks current goal, completed/remaining steps, next action,
 * recovery after interruption, and conversation continuation.
 */

import type {
  BrainV1Clarification,
  BrainV1Intent,
  BrainV1MissingField,
  BrainV1NextAction,
  BrainV1PlannerState,
  BrainV1PlannerStep,
  BrainV1PlannerStepId,
  BrainV1ToolId,
} from './types'
import { emptyPlannerState } from './types'

export type BrainV1Plan =
  | { kind: 'clarify', clarification: BrainV1Clarification }
  | { kind: 'search', tools: BrainV1ToolId[] }
  | { kind: 'advise', tools: BrainV1ToolId[] }
  | { kind: 'chat' }
  | { kind: 'resume', fromStep: BrainV1PlannerStepId, clarification?: BrainV1Clarification }

const PIPELINE_STEPS: BrainV1PlannerStepId[] = [
  'understand_request',
  'resolve_conversation_context',
  'load_memory',
  'detect_missing_entities',
  'choose_tools',
  'collect_provider_results',
  'evaluate_results',
  'rank_recommendations',
  'generate_natural_answer',
  'generate_booking_actions',
]

function goalForIntent(intent: BrainV1Intent): string {
  switch (intent) {
    case 'flight_search':
      return 'Find and recommend flights'
    case 'hotel_search':
      return 'Find and recommend hotels'
    case 'package_search':
      return 'Find and recommend travel packages'
    case 'visa_question':
      return 'Answer visa question'
    case 'budget_planning':
      return 'Plan trip budget'
    case 'travel_advice':
      return 'Provide travel advice'
    case 'booking_modification':
      return 'Modify booking'
    case 'cancellation':
      return 'Cancel booking'
    case 'price_comparison':
      return 'Compare prices'
    case 'price_prediction':
      return 'Predict prices'
    case 'general_conversation':
      return 'Continue conversation'
    default:
      return 'Understand traveler request'
  }
}

export class ConversationPlanner {
  plan(input: {
    intent: BrainV1Intent
    missing: BrainV1MissingField[]
    clarifications: BrainV1Clarification[]
    tools: BrainV1ToolId[]
    priorPlanner?: BrainV1PlannerState | null
    interrupted?: boolean
    hasOffers?: boolean
  }): { plan: BrainV1Plan, state: BrainV1PlannerState } {
    const wasInterrupted = Boolean(input.priorPlanner?.interrupted || input.interrupted)
    const resumed = wasInterrupted

    const completed: BrainV1PlannerStepId[] = [
      'understand_request',
      'resolve_conversation_context',
      'load_memory',
      'detect_missing_entities',
    ]

    let nextAction: BrainV1NextAction
    let plan: BrainV1Plan

    if (input.clarifications[0]) {
      nextAction = { kind: 'clarify', field: input.clarifications[0].field }
      plan = wasInterrupted
        ? {
            kind: 'resume',
            fromStep: 'detect_missing_entities',
            clarification: input.clarifications[0],
          }
        : { kind: 'clarify', clarification: input.clarifications[0] }
    } else if (
      input.intent === 'general_conversation'
      || input.intent === 'unknown'
    ) {
      nextAction = { kind: 'chat' }
      plan = { kind: 'chat' }
      completed.push('choose_tools', 'generate_natural_answer')
    } else if (
      input.intent === 'travel_advice'
      || input.intent === 'visa_question'
      || input.intent === 'budget_planning'
    ) {
      nextAction = { kind: 'advise' }
      plan = { kind: 'advise', tools: input.tools }
      completed.push('choose_tools', 'generate_natural_answer')
    } else if (input.tools.some((t) => t !== 'none')) {
      completed.push('choose_tools')
      if (input.hasOffers) {
        completed.push(
          'collect_provider_results',
          'evaluate_results',
          'rank_recommendations',
          'generate_natural_answer',
          'generate_booking_actions',
        )
        nextAction = { kind: 'recommend' }
      } else {
        completed.push('collect_provider_results')
        nextAction = { kind: 'invoke_tools', tools: input.tools }
      }
      plan = wasInterrupted
        ? { kind: 'resume', fromStep: 'choose_tools' }
        : { kind: 'search', tools: input.tools }
    } else {
      nextAction = { kind: 'advise' }
      plan = { kind: 'advise', tools: input.tools }
      completed.push('choose_tools', 'generate_natural_answer')
    }

    if (wasInterrupted && nextAction.kind !== 'clarify') {
      nextAction = {
        kind: 'resume',
        fromStep: completed[completed.length - 1] ?? 'understand_request',
      }
    }

    const remaining = PIPELINE_STEPS.filter((s) => !completed.includes(s))
    const steps: BrainV1PlannerStep[] = PIPELINE_STEPS.map((id) => ({
      id,
      status: completed.includes(id)
        ? 'completed'
        : remaining[0] === id
          ? 'pending'
          : 'pending',
      detail: id,
    }))

    const continuationSummary = wasInterrupted
      ? `Resumed after interruption; goal=${goalForIntent(input.intent)}`
      : input.priorPlanner?.continuationSummary
        ?? `Continuing toward ${goalForIntent(input.intent)}`

    const state: BrainV1PlannerState = {
      currentGoal: goalForIntent(input.intent),
      completedSteps: completed,
      remainingSteps: remaining,
      steps,
      nextAction,
      interrupted: false,
      resumed: wasInterrupted || resumed,
      continuationSummary,
    }

    return { plan, state }
  }

  /** Mark a planner state as interrupted so the next turn can resume. */
  markInterrupted(state: BrainV1PlannerState): BrainV1PlannerState {
    return {
      ...state,
      interrupted: true,
      resumed: false,
      continuationSummary: `Interrupted at next=${state.nextAction.kind}; will resume`,
    }
  }

  createIdleState(): BrainV1PlannerState {
    return emptyPlannerState()
  }
}

export function createConversationPlanner(): ConversationPlanner {
  return new ConversationPlanner()
}
