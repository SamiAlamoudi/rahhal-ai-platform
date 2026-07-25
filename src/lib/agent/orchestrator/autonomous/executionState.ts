/**
 * Phase 6 — ExecutionState
 */

import type { ExecutionStateSnapshot, MissionPlan, WorkflowPhase } from './types'

export function createExecutionState(mission: MissionPlan): ExecutionStateSnapshot {
  return {
    missionId: mission.id,
    phase: 'planning',
    currentTaskId: mission.tasks[0]?.id ?? null,
    completedTaskIds: [],
    blockedTaskIds: [],
    retryCounts: {},
    waitingForApproval: false,
    lastError: null,
  }
}

export function advanceExecution(
  state: ExecutionStateSnapshot,
  mission: MissionPlan,
): ExecutionStateSnapshot {
  const completed = new Set(state.completedTaskIds)
  const next = mission.tasks.find((t) => !completed.has(t.id) && t.status !== 'skipped')
  let phase: WorkflowPhase = 'planning'
  if (next?.kind === 'search') phase = 'searching'
  else if (next?.kind === 'compare') phase = 'comparing'
  else if (next?.kind === 'wait_approval') phase = 'waiting'
  else if (next?.kind === 'recommend' || next?.kind === 'reason') phase = 'planning'
  else if (state.lastError) phase = 'retry'

  return {
    ...state,
    currentTaskId: next?.id ?? null,
    phase,
    waitingForApproval: next?.kind === 'wait_approval',
  }
}

export function markTaskDone(
  state: ExecutionStateSnapshot,
  taskId: string,
): ExecutionStateSnapshot {
  if (state.completedTaskIds.includes(taskId)) return state
  return {
    ...state,
    completedTaskIds: [...state.completedTaskIds, taskId],
    blockedTaskIds: state.blockedTaskIds.filter((id) => id !== taskId),
  }
}

export const ExecutionState = {
  create: createExecutionState,
  advance: advanceExecution,
  markDone: markTaskDone,
}
