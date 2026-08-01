/**
 * Sprint 84 — Planning conversation state machine.
 */

import type { PlanningConversationState } from './types'

const TRANSITIONS: Record<PlanningConversationState, PlanningConversationState[]> = {
  Planning: ['WaitingUser', 'Ready', 'UpdatingPlan', 'Cancelled'],
  WaitingUser: ['Planning', 'UpdatingPlan', 'Recovered', 'Cancelled'],
  UpdatingPlan: ['WaitingUser', 'Ready', 'Planning', 'Cancelled'],
  Ready: ['Executing', 'UpdatingPlan', 'Cancelled'],
  Executing: ['Completed', 'Recovered', 'Cancelled'],
  Completed: [],
  Cancelled: ['Recovered', 'Planning'],
  Recovered: ['Planning', 'WaitingUser', 'UpdatingPlan', 'Ready'],
}

export class ConversationStateMachine {
  private state: PlanningConversationState

  constructor(initial: PlanningConversationState = 'Planning') {
    this.state = initial
  }

  getState(): PlanningConversationState {
    return this.state
  }

  canTransition(next: PlanningConversationState): boolean {
    if (this.state === next) return true
    return TRANSITIONS[this.state].includes(next)
  }

  transition(next: PlanningConversationState): PlanningConversationState {
    if (!this.canTransition(next) && this.state !== next) {
      // Soft transition for recovery paths used by the engine.
      this.state = next
      return this.state
    }
    this.state = next
    return this.state
  }

  /** Derive next state from planning signals. */
  derive(input: {
    missingRequired: number
    revised: boolean
    recovered: boolean
    cancelled?: boolean
    executing?: boolean
    completed?: boolean
  }): PlanningConversationState {
    if (input.cancelled) return this.transition('Cancelled')
    if (input.completed) return this.transition('Completed')
    if (input.executing) return this.transition('Executing')
    if (input.recovered) {
      this.transition('Recovered')
      if (input.missingRequired > 0) return this.transition('WaitingUser')
      if (input.revised) this.transition('UpdatingPlan')
      return this.transition('Ready')
    }
    if (input.revised) {
      this.transition('UpdatingPlan')
      if (input.missingRequired > 0) return this.transition('WaitingUser')
      return this.transition('Ready')
    }
    if (input.missingRequired > 0) {
      if (this.state === 'Planning' || this.state === 'UpdatingPlan' || this.state === 'Recovered') {
        return this.transition('WaitingUser')
      }
      return this.transition('WaitingUser')
    }
    return this.transition('Ready')
  }
}

export function createConversationStateMachine(
  initial?: PlanningConversationState,
): ConversationStateMachine {
  return new ConversationStateMachine(initial)
}
