import { logChat } from '../../chat/chatLogger'
import type {
  AutonomousObservabilityLog,
  AutonomousProgressEvent,
  AutonomousProgressPhase,
  AutonomousExecutionState,
} from './types'

export function createProgressEvent(input: {
  phase: AutonomousProgressPhase
  state: AutonomousExecutionState
  message: string
  goalId?: string
  activeTaskId?: string
  activeTaskKind?: AutonomousProgressEvent['activeTaskKind']
  providerId?: string
  retryCount?: number
  completedTaskIds?: string[]
  pendingTaskIds?: string[]
}): AutonomousProgressEvent {
  return {
    ...input,
    at: new Date().toISOString(),
  }
}

export function phaseForState(state: AutonomousExecutionState): AutonomousProgressPhase {
  switch (state) {
    case 'IDLE':
    case 'UNDERSTANDING':
    case 'PLANNING':
      return 'Thinking'
    case 'EXECUTING':
    case 'WAITING_PROVIDER':
    case 'RECOVERING':
      return 'Searching'
    case 'COMPLETE':
      return 'Completed'
    case 'FAILED':
      return 'Completed'
    default:
      return 'Thinking'
  }
}

export function appendObservabilityLog(
  logs: AutonomousObservabilityLog[],
  entry: Omit<AutonomousObservabilityLog, 'at'> & { at?: string },
  limit = 40,
): AutonomousObservabilityLog[] {
  const next: AutonomousObservabilityLog = {
    at: entry.at ?? new Date().toISOString(),
    goal: entry.goal,
    activeTask: entry.activeTask,
    providerUsed: entry.providerUsed,
    retryCount: entry.retryCount,
    durationMs: entry.durationMs,
    outcome: entry.outcome,
    state: entry.state,
    detail: entry.detail,
  }
  const merged = [...logs, next]
  return merged.length > limit ? merged.slice(merged.length - limit) : merged
}

const recentLogs: AutonomousObservabilityLog[] = []

/** Structured observability — goal, active task, provider, retries, duration, outcome. */
export function logAutonomousEvent(entry: AutonomousObservabilityLog): void {
  recentLogs.push(entry)
  if (recentLogs.length > 100) recentLogs.shift()
  logChat('debug', 'autonomous.agent', entry.outcome, {
    goal: entry.goal,
    activeTask: entry.activeTask,
    providerUsed: entry.providerUsed,
    retryCount: entry.retryCount,
    durationMs: entry.durationMs,
    state: entry.state,
    detail: entry.detail,
    at: entry.at,
  })
}

export function getRecentAutonomousLogs(): readonly AutonomousObservabilityLog[] {
  return recentLogs
}

export function clearAutonomousLogs(): void {
  recentLogs.length = 0
}
