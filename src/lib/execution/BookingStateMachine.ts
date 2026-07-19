/**
 * Sprint 33 — Booking state machine for itinerary execution.
 */

import { ExecutionError } from './ExecutionErrors'
import type { ExecutionState } from './ExecutionTypes'

const TRANSITIONS: Record<ExecutionState, ExecutionState[]> = {
  CREATED: ['VALIDATED', 'FAILED', 'CANCELLED'],
  // Hotel-only plans may skip FLIGHT_RESERVED; flight-only may complete after flight.
  VALIDATED: ['FLIGHT_RESERVED', 'HOTEL_RESERVED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  FLIGHT_RESERVED: ['HOTEL_RESERVED', 'COMPLETED', 'ROLLBACK', 'FAILED', 'CANCELLED'],
  HOTEL_RESERVED: ['COMPLETED', 'ROLLBACK', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: ['CREATED'], // retry restarts from CREATED
  CANCELLED: [],
  ROLLBACK: ['FAILED', 'CANCELLED'],
}

export class BookingStateMachine {
  private state: ExecutionState

  constructor(initial: ExecutionState = 'CREATED') {
    this.state = initial
  }

  getState(): ExecutionState {
    return this.state
  }

  canTransition(next: ExecutionState): boolean {
    return TRANSITIONS[this.state].includes(next)
  }

  transition(next: ExecutionState, reason?: string): ExecutionState {
    if (!this.canTransition(next)) {
      throw new ExecutionError(
        'STATE_TRANSITION_INVALID',
        `Cannot transition from ${this.state} to ${next}${reason ? ` (${reason})` : ''}`,
        { details: { from: this.state, to: next, reason } },
      )
    }
    this.state = next
    return this.state
  }

  resetForRetry(): ExecutionState {
    this.state = 'CREATED'
    return this.state
  }

  canRetry(): boolean {
    return this.state === 'FAILED'
  }

  canCancel(): boolean {
    return TRANSITIONS[this.state].includes('CANCELLED')
  }

  static allowedTransitions(from: ExecutionState): ExecutionState[] {
    return [...TRANSITIONS[from]]
  }
}
