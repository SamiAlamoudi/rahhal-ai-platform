/**
 * Phase 6 — WorkflowManager
 * Long-running workflow phases: searching, comparing, waiting, retry, resume, cancel.
 */

import type { ExecutionStateSnapshot, MissionPlan, MissionStatus, WorkflowPhase } from './types'

export function deriveMissionStatus(
  execution: ExecutionStateSnapshot,
  cancelled = false,
): MissionStatus {
  if (cancelled) return 'cancelled'
  if (execution.phase === 'retry') return 'recovering'
  if (execution.waitingForApproval || execution.phase === 'waiting') return 'waiting_approval'
  if (execution.phase === 'searching' || execution.phase === 'comparing') return 'executing'
  if (!execution.currentTaskId && execution.completedTaskIds.length > 0) return 'completed'
  if (execution.phase === 'planning') return 'planning'
  return 'executing'
}

export function applyWorkflowCommand(
  mission: MissionPlan,
  execution: ExecutionStateSnapshot,
  command: 'resume' | 'cancel' | 'retry',
): { mission: MissionPlan; execution: ExecutionStateSnapshot } {
  if (command === 'cancel') {
    return {
      mission: {
        ...mission,
        status: 'cancelled',
        tasks: mission.tasks.map((t) =>
          t.status === 'done' ? t : { ...t, status: 'cancelled' as const },
        ),
        updatedAt: new Date().toISOString(),
      },
      execution: { ...execution, phase: 'cancel', currentTaskId: null },
    }
  }
  if (command === 'retry') {
    return {
      mission: { ...mission, status: 'recovering', updatedAt: new Date().toISOString() },
      execution: {
        ...execution,
        phase: 'retry',
        lastError: execution.lastError ?? 'retry_requested',
      },
    }
  }
  // resume
  return {
    mission: { ...mission, status: 'executing', updatedAt: new Date().toISOString() },
    execution: {
      ...execution,
      phase: (execution.waitingForApproval ? 'waiting' : 'planning') as WorkflowPhase,
      lastError: null,
    },
  }
}

export const WorkflowManager = {
  deriveStatus: deriveMissionStatus,
  applyCommand: applyWorkflowCommand,
}
