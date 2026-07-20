import type { AutonomousExecutionState } from './types'

const ALLOWED: Record<AutonomousExecutionState, ReadonlySet<AutonomousExecutionState>> = {
  IDLE: new Set(['UNDERSTANDING', 'IDLE']),
  UNDERSTANDING: new Set(['PLANNING', 'COMPLETE', 'FAILED', 'IDLE']),
  PLANNING: new Set(['EXECUTING', 'COMPLETE', 'FAILED', 'IDLE']),
  EXECUTING: new Set(['WAITING_PROVIDER', 'RECOVERING', 'COMPLETE', 'FAILED']),
  WAITING_PROVIDER: new Set(['EXECUTING', 'RECOVERING', 'COMPLETE', 'FAILED']),
  RECOVERING: new Set(['EXECUTING', 'WAITING_PROVIDER', 'COMPLETE', 'FAILED']),
  COMPLETE: new Set(['IDLE', 'UNDERSTANDING']),
  FAILED: new Set(['IDLE', 'UNDERSTANDING', 'RECOVERING']),
}

export class AutonomousStateMachine {
  private state: AutonomousExecutionState

  constructor(initial: AutonomousExecutionState = 'IDLE') {
    this.state = initial
  }

  get current(): AutonomousExecutionState {
    return this.state
  }

  canTransition(next: AutonomousExecutionState): boolean {
    return ALLOWED[this.state].has(next)
  }

  transition(next: AutonomousExecutionState): AutonomousExecutionState {
    if (!this.canTransition(next)) {
      throw new Error(`invalid_autonomous_transition:${this.state}->${next}`)
    }
    this.state = next
    return this.state
  }

  /** Safe transition used by the runner — no-ops invalid moves by staying put. */
  tryTransition(next: AutonomousExecutionState): AutonomousExecutionState {
    if (this.state === next) return this.state
    if (!this.canTransition(next)) return this.state
    this.state = next
    return this.state
  }

  reset(): AutonomousExecutionState {
    this.state = 'IDLE'
    return this.state
  }
}

export function isTerminalAutonomousState(state: AutonomousExecutionState): boolean {
  return state === 'COMPLETE' || state === 'FAILED'
}
