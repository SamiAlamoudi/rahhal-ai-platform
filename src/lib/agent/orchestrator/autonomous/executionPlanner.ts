/**
 * Phase 6 — Mission ExecutionPlanner
 * Named distinctly from Sprint 113 `../ExecutionPlanner`.
 * Builds a MissionPlan from goal + tasks.
 */

import { planMissionTasks } from './taskPlanner'
import type { MissionPlan, MissionStatus, TravelGoal } from './types'

let missionSeq = 0

export function buildMissionPlan(input: {
  goal: TravelGoal
  locale?: 'ar' | 'en'
  prior?: MissionPlan | null
  status?: MissionStatus
}): MissionPlan {
  missionSeq += 1
  const tasks = planMissionTasks(input.goal)
  const dest = input.goal.destination ?? 'open destination'
  const purpose = input.goal.purpose ?? 'trip'
  const now = new Date().toISOString()
  return {
    id: input.prior?.id ?? `mission-${missionSeq}`,
    title: `${purpose} · ${dest}`,
    goal: input.goal,
    tasks,
    status: input.status ?? 'planning',
    createdAt: input.prior?.createdAt ?? now,
    updatedAt: now,
  }
}

/** @alias Phase 6 mission execution planner (not Sprint 113). */
export const ExecutionPlanner = {
  buildMissionPlan,
}

export const MissionExecutionPlanner = ExecutionPlanner
