/**
 * Phase 6 — AgentOrchestrator
 *
 * Autonomous mission loop:
 * understand → plan tasks → execute step → route tools → recover/replan → clarify
 *
 * Pure / deterministic. Production APIs disabled. Does not replace planTurn.
 */

import { explainMissionDecisions } from './decisionEngine'
import { buildMissionPlan } from './executionPlanner'
import { updateExecutionMemory } from './executionMemory'
import {
  advanceExecution,
  createExecutionState,
  markTaskDone,
} from './executionState'
import { updateTravelGoal } from './goalManager'
import { detectConflicts, planRecovery } from './recoveryManager'
import { nextRunnableTask, prioritizeClarifications } from './taskQueue'
import { routeTool } from './toolOrchestrator'
import { deriveMissionStatus } from './workflowManager'
import type {
  AutonomousOrchestratorInput,
  AutonomousOrchestratorResult,
  MissionTask,
  OrchestratorTimelineEntry,
} from './types'

export const PHASE6_AUTONOMOUS_ORCHESTRATOR_VERSION =
  'phase6-autonomous-agent-orchestrator-v1' as const

function timeline(
  kind: OrchestratorTimelineEntry['kind'],
  label: string,
  detail: string,
): OrchestratorTimelineEntry {
  return { at: new Date().toISOString(), kind, label, detail }
}

function simulateTaskResult(task: MissionTask, goalDestination: string | null): string {
  switch (task.kind) {
    case 'understand_request':
      return `Understood goal for ${goalDestination ?? 'open destination'}`
    case 'collect_missing':
      return task.unblockQuestion ? 'Clarification queued' : 'No blocking gaps'
    case 'determine_season':
      return 'Season strategy drafted (estimate)'
    case 'estimate_budget':
      return 'Budget envelope drafted (estimate until tools)'
    case 'flight_strategy':
      return 'Flight strategy ready'
    case 'hotel_strategy':
      return 'Hotel strategy ready'
    case 'visa_check':
      return 'Visa requires verification — unknown until checked'
    case 'recommend':
      return 'Recommendation prepared'
    default:
      return `${task.kind} advanced`
  }
}

function buildReplyPreview(input: {
  locale: 'ar' | 'en'
  destination: string | null
  purpose: string | null
  replanned: boolean
  clarification: string | null
  conflicts: string[]
}): string {
  const ar = input.locale === 'ar'
  const parts: string[] = []
  if (input.replanned) {
    parts.push(ar ? 'حدّثت المهمة بناءً على تغييرك.' : 'I re-planned the mission around your change.')
  }
  if (input.destination) {
    parts.push(
      ar
        ? `أبني مهمة سفر حول ${input.destination}${input.purpose === 'honeymoon' ? ' لشهر العسل' : ''}.`
        : `I’m building a travel mission around ${input.destination}${input.purpose === 'honeymoon' ? ' for a honeymoon' : ''}.`,
    )
  } else {
    parts.push(
      ar
        ? 'أبدأ بمهمة سفر وأستخرج التفاصيل بنفسي.'
        : 'I’ll start a travel mission and extract details myself.',
    )
  }
  if (input.conflicts[0]) {
    parts.push(ar ? `ملاحظة: ${input.conflicts[0]}` : `Note: ${input.conflicts[0]}`)
  }
  if (input.clarification) {
    parts.push(input.clarification)
  }
  parts.push(
    ar
      ? 'لن أخترع حجوزات أو أسعاراً — البحث يأتي من الأدوات لاحقاً.'
      : 'I won’t invent bookings or prices — search comes from tools later.',
  )
  return parts.join('\n\n')
}

/**
 * Run one autonomous orchestrator turn (mission plan + one execution step).
 */
export function runAutonomousAgentOrchestrator(
  input: AutonomousOrchestratorInput,
): AutonomousOrchestratorResult {
  const locale = input.locale ?? (/[\u0600-\u06FF]/.test(input.userText) ? 'ar' : 'en')
  const entries: OrchestratorTimelineEntry[] = []

  const goalUpdate = updateTravelGoal(input.priorMission?.goal, input.userText)
  entries.push(
    timeline(
      'mission',
      'Goal sync',
      goalUpdate.changed
        ? `changed:${goalUpdate.changeReasons.join(',')}`
        : `goal v${goalUpdate.goal.version}`,
    ),
  )

  const replanned = goalUpdate.changed
  const mission = buildMissionPlan({
    goal: goalUpdate.goal,
    locale,
    prior: replanned ? null : input.priorMission,
    status: replanned ? 'replanning' : 'planning',
  })
  if (replanned) {
    entries.push(timeline('replan', 'Dynamic replan', goalUpdate.changeReasons.join(',')))
  }
  entries.push(timeline('mission', 'Mission planned', `${mission.title} · ${mission.tasks.length} tasks`))

  let execution = input.priorExecution && !replanned
    ? { ...input.priorExecution, missionId: mission.id }
    : createExecutionState(mission)

  // Self-correction: conflict detection
  const conflicts = detectConflicts(goalUpdate.goal)
  if (conflicts.length) {
    entries.push(timeline('reasoning', 'Conflict detected', conflicts[0]!))
  }

  // Execute understand + optionally next non-blocking tasks until collect_missing
  const autoKinds = new Set([
    'understand_request',
    'determine_season',
    'estimate_budget',
    'flight_strategy',
    'hotel_strategy',
    'visa_check',
  ])

  let guard = 0
  while (guard < 6) {
    guard += 1
    const next = nextRunnableTask(mission.tasks, execution.completedTaskIds)
    if (!next) break
    if (next.kind === 'collect_missing' && next.unblockQuestion) {
      execution = {
        ...execution,
        currentTaskId: next.id,
        blockedTaskIds: uniqIds([...execution.blockedTaskIds, next.id]),
      }
      entries.push(timeline('task', 'Blocked on clarification', next.unblockQuestion))
      break
    }
    if (next.kind === 'wait_approval') {
      execution = { ...execution, currentTaskId: next.id, waitingForApproval: true, phase: 'waiting' }
      entries.push(timeline('execution', 'Waiting approval', next.title))
      break
    }
    if (next.kind === 'search' || next.kind === 'compare') {
      // Don't call production APIs — mark strategy done but leave search pending as waiting
      execution = {
        ...execution,
        currentTaskId: next.id,
        phase: next.kind === 'search' ? 'searching' : 'comparing',
      }
      entries.push(
        timeline('tool', 'Tool ready (APIs disabled)', `${next.tool} — not invoked`),
      )
      break
    }
    if (!autoKinds.has(next.kind) && next.kind !== 'activities' && next.kind !== 'reason' && next.kind !== 'recommend') {
      break
    }

    const summary = simulateTaskResult(next, goalUpdate.goal.destination)
    const idx = mission.tasks.findIndex((t) => t.id === next.id)
    if (idx >= 0) {
      mission.tasks[idx] = {
        ...mission.tasks[idx]!,
        status: 'done',
        resultSummary: summary,
        estimateOnly:
          next.kind === 'estimate_budget'
          || next.kind === 'determine_season'
          || next.kind === 'visa_check',
      }
    }
    execution = markTaskDone(execution, next.id)
    entries.push(timeline('task', next.title, summary))
    execution = advanceExecution(execution, mission)
  }

  const current = mission.tasks.find((t) => t.id === execution.currentTaskId) ?? null
  const toolDecision = routeTool({
    task: current,
    goal: goalUpdate.goal,
    userText: input.userText,
  })
  entries.push(timeline('tool', 'Tool routing', `${toolDecision.tool} — ${toolDecision.reason}`))

  const missingCritical = !goalUpdate.goal.destination || !goalUpdate.goal.monthHint
  const recoveries = planRecovery({
    toolDecision,
    goal: goalUpdate.goal,
    failedTool: null,
    missingCritical,
    confidenceLow: !goalUpdate.goal.destination,
    currentTask: current,
  })
  for (const r of recoveries) {
    entries.push(timeline('recovery', r.kind, r.detail))
  }

  const decisions = explainMissionDecisions({ goal: goalUpdate.goal, mission })
  entries.push(timeline('reasoning', 'Decision explanations', `${decisions.length} debug records`))

  const clarifications = prioritizeClarifications(mission.tasks).askNow
  const memory = updateExecutionMemory({
    prior: input.priorMemory,
    goal: goalUpdate.goal,
    tasks: mission.tasks,
    userText: input.userText,
    completedIds: execution.completedTaskIds,
  })

  mission.status = replanned ? 'replanning' : deriveMissionStatus(execution)
  mission.updatedAt = new Date().toISOString()

  const replyPreview = buildReplyPreview({
    locale,
    destination: goalUpdate.goal.destination,
    purpose: goalUpdate.goal.purpose,
    replanned,
    clarification: clarifications[0] ?? null,
    conflicts,
  })

  return {
    enabled: true,
    locale,
    mission,
    execution,
    memory,
    toolDecision,
    decisions,
    recoveries,
    clarifications,
    timeline: entries,
    replanned,
    replyPreview,
  }
}

function uniqIds(ids: string[]): string[] {
  return [...new Set(ids)]
}

export const AgentOrchestrator = {
  run: runAutonomousAgentOrchestrator,
  version: PHASE6_AUTONOMOUS_ORCHESTRATOR_VERSION,
}
