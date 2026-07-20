/**
 * Autonomous turn runner — goal → plan → tools (retry/recover) → snapshot.
 * Never authors traveler-facing prose (Conversation Brain remains the language layer).
 */

import { applyIntelligentDecisions } from '../decision'
import { buildTripPlan } from '../buildItinerary'
import { mergeToolResultsIntoPlan } from '../tools/mergeToolResults'
import type { AgentToolRegistry, AgentToolResult, ToolExecutionBatch } from '../tools/types'
import type { AgentMemory, TripPlan } from '../types'
import {
  buildExecutionPlan,
  completedTasks,
  markTaskCompleted,
  markTaskRunning,
  markTaskSkipped,
  pendingTasks,
} from './executionPlan'
import { completeGoal, criticalBlockingFields, upsertTravelGoal } from './goalEngine'
import {
  appendObservabilityLog,
  createProgressEvent,
  logAutonomousEvent,
  phaseForState,
} from './observability'
import { AutonomousStateMachine } from './stateMachine'
import { runToolPlan } from './toolPlanner'
import type {
  AutonomousAgentSnapshot,
  AutonomousObservabilityLog,
  AutonomousProgressEvent,
  AutonomousRunResult,
} from './types'

export interface AutonomousRunnerInput {
  conversationId: string
  userText: string
  memory: AgentMemory
  registry: AgentToolRegistry
  priorSnapshot?: AutonomousAgentSnapshot | null
  signal?: AbortSignal
  seed?: string
  basePlan?: TripPlan
  onProgress?: (event: AutonomousProgressEvent) => void
}

export async function runAutonomousTurn(input: AutonomousRunnerInput): Promise<AutonomousRunResult> {
  const startedMs = Date.now()
  const machine = new AutonomousStateMachine(input.priorSnapshot?.state === 'COMPLETE' ? 'IDLE' : 'IDLE')
  let logs: AutonomousObservabilityLog[] = input.priorSnapshot?.logs?.slice(-20) ?? []
  let lastProviderId: string | null = null
  let totalRetries = 0
  let recoveredFromFailures = false

  const emit = (
    partial: Omit<AutonomousProgressEvent, 'at' | 'phase'> & { phase?: AutonomousProgressEvent['phase'] },
  ) => {
    const event = createProgressEvent({
      phase: partial.phase ?? phaseForState(partial.state),
      state: partial.state,
      message: partial.message,
      goalId: partial.goalId,
      activeTaskId: partial.activeTaskId,
      activeTaskKind: partial.activeTaskKind,
      providerId: partial.providerId,
      retryCount: partial.retryCount,
      completedTaskIds: partial.completedTaskIds,
      pendingTaskIds: partial.pendingTaskIds,
    })
    input.onProgress?.(event)
    return event
  }

  machine.transition('UNDERSTANDING')
  emit({
    state: 'UNDERSTANDING',
    phase: 'Thinking',
    message: 'Understanding travel goal',
  })

  const goal = upsertTravelGoal({
    conversationId: input.conversationId,
    userText: input.userText,
    memory: input.memory,
    priorGoal: input.priorSnapshot?.goal ?? null,
  })

  const blocking = criticalBlockingFields(
    input.memory.requirements,
    input.memory.missingFields,
  )

  // Ask at most one clarification — only when exactly one critical field blocks progress.
  if (blocking.length > 1) {
    // Prefer destination first, then duration, then budget, then travelers.
    const priority = ['destination', 'durationDays', 'budgetAmount', 'travelers']
    blocking.sort((a, b) => priority.indexOf(a) - priority.indexOf(b))
  }
  const singleBlocker = blocking.length > 0 ? blocking[0]! : null
  const needsClarification = blocking.length > 0

  machine.transition('PLANNING')
  emit({
    state: 'PLANNING',
    phase: 'Thinking',
    message: 'Building execution plan',
    goalId: goal.id,
  })

  let plan = buildExecutionPlan({
    goal,
    requirements: input.memory.requirements,
    // Pass only one critical field into the plan so we never ask a multi-field inventory.
    missingCriticalFields: singleBlocker ? [singleBlocker] : [],
    locale: input.memory.locale,
  })

  logs = appendObservabilityLog(logs, {
    goal: goal.objective,
    activeTask: null,
    providerUsed: null,
    retryCount: 0,
    durationMs: Date.now() - startedMs,
    outcome: needsClarification ? 'blocked' : 'ok',
    state: 'PLANNING',
    detail: `tasks=${plan.tasks.length}`,
  })
  logAutonomousEvent(logs[logs.length - 1]!)

  if (needsClarification) {
    // Mark understand complete; clarify remains pending for the Conversation Brain turn.
    const understand = plan.tasks.find((t) => t.kind === 'understand')
    if (understand) {
      plan = markTaskCompleted(plan, understand.id, {}, new Date())
    }
    machine.transition('COMPLETE')
    const snapshot = buildSnapshot({
      state: 'COMPLETE',
      goal: { ...goal, status: 'blocked', blockingFields: blocking },
      plan,
      lastProviderId,
      totalRetries,
      durationMs: Date.now() - startedMs,
      outcome: 'blocked',
      logs,
      recoveredFromFailures: false,
    })
    emit({
      state: 'COMPLETE',
      phase: 'Completed',
      message: 'Need one clarification before continuing',
      goalId: goal.id,
      completedTaskIds: snapshot.completedTaskIds,
      pendingTaskIds: snapshot.pendingTaskIds,
    })
    return {
      state: 'COMPLETE',
      snapshot,
      batch: emptyBatch(),
      toolResults: [],
      planBuilt: false,
      needsClarification: true,
      clarificationField: singleBlocker,
      tripPlan: input.memory.tripPlan,
    }
  }

  machine.transition('EXECUTING')
  emit({
    state: 'EXECUTING',
    phase: 'Searching',
    message: 'Executing autonomous plan',
    goalId: goal.id,
  })

  const toolResults: AgentToolResult[] = []

  for (const task of plan.tasks) {
    if (input.signal?.aborted) break

    plan = markTaskRunning(plan, task.id)
    emit({
      state: 'EXECUTING',
      phase: task.kind === 'compare_options' ? 'Comparing' : task.kind === 'present' ? 'Completed' : 'Searching',
      message: task.title,
      goalId: goal.id,
      activeTaskId: task.id,
      activeTaskKind: task.kind,
      completedTaskIds: completedTasks(plan).map((t) => t.id),
      pendingTaskIds: pendingTasks(plan).map((t) => t.id),
    })

    if (task.kind === 'understand' || task.kind === 'present' || task.kind === 'compare_options' || task.kind === 'build_plan') {
      // Local orchestration steps — no external provider.
      plan = markTaskCompleted(plan, task.id, {
        durationMs: 0,
        providerId: 'autonomous-local',
      })
      lastProviderId = 'autonomous-local'
      continue
    }

    if (task.kind === 'clarify') {
      plan = markTaskSkipped(plan, task.id, 'clarification_not_required')
      continue
    }

    if (!task.tool) {
      plan = markTaskSkipped(plan, task.id, 'no_tool')
      continue
    }

    // Execute one tool immediately so progress streams per task.
    const toolRun = await runToolPlan({
      registry: input.registry,
      tools: [{
        name: task.tool,
        alternatives: task.alternatives,
        maxRetries: task.maxRetries,
      }],
      ctx: {
        requirements: input.memory.requirements,
        tripPlan: input.memory.tripPlan,
        itinerary: input.memory.tripPlan,
        locale: input.memory.locale,
        signal: input.signal,
      },
      onProgress: (event) => {
        machine.tryTransition(event.state)
        emit({
          ...event,
          goalId: goal.id,
          activeTaskId: task.id,
          activeTaskKind: task.kind,
        })
      },
    })

    totalRetries += toolRun.totalRetries
    if (toolRun.recoveredFromFailures) recoveredFromFailures = true
    toolResults.push(...toolRun.results)
    const ok = toolRun.results.some((r) => r.status === 'ok')
    const used = toolRun.results.find((r) => r.status === 'ok') ?? toolRun.results[toolRun.results.length - 1]
    lastProviderId = used?.meta?.providerId ?? lastProviderId

    if (ok) {
      plan = markTaskCompleted(plan, task.id, {
        retryCount: toolRun.totalRetries,
        providerId: used?.meta?.providerId,
        durationMs: toolRun.durationMs,
      })
    } else {
      // Soft-fail and continue — never terminate the conversation for one provider.
      recoveredFromFailures = true
      machine.tryTransition('RECOVERING')
      emit({
        state: 'RECOVERING',
        phase: 'Searching',
        message: `Continuing after ${task.tool} failure`,
        goalId: goal.id,
        activeTaskId: task.id,
        providerId: used?.meta?.providerId,
        retryCount: toolRun.totalRetries,
      })
      plan = markTaskSkipped(plan, task.id, used?.error || used?.summary || 'provider_failed')
    }

    logs = appendObservabilityLog(logs, {
      goal: goal.objective,
      activeTask: task.kind,
      providerUsed: lastProviderId,
      retryCount: toolRun.totalRetries,
      durationMs: toolRun.durationMs,
      outcome: ok ? (toolRun.recoveredFromFailures ? 'degraded' : 'ok') : 'degraded',
      state: machine.current,
      detail: task.tool,
    })
    logAutonomousEvent(logs[logs.length - 1]!)
  }

  // Compare / build plan from aggregated tool results.
  emit({
    state: 'EXECUTING',
    phase: 'Comparing',
    message: 'Comparing options and building plan',
    goalId: goal.id,
  })

  const batch: ToolExecutionBatch = {
    results: toolResults,
    selected: [...new Set(toolResults.map((r) => r.tool))],
    okCount: toolResults.filter((r) => r.status === 'ok').length,
    failedCount: toolResults.filter((r) => r.status === 'error' || r.status === 'timeout').length,
    durationMs: Date.now() - startedMs,
  }

  const base = input.basePlan ?? buildTripPlan({
    requirements: input.memory.requirements,
    conversationId: input.conversationId,
    locale: input.memory.locale,
    seed: input.seed,
  })
  const merged = mergeToolResultsIntoPlan(base, toolResults)
  const tripPlan = applyIntelligentDecisions(merged, toolResults, input.memory.requirements)
  const finishedGoal = completeGoal(goal)

  machine.tryTransition('COMPLETE')
  const durationMs = Date.now() - startedMs
  const outcome = batch.okCount === 0 && batch.selected.length > 0
    ? 'degraded'
    : recoveredFromFailures
      ? 'degraded'
      : 'ok'

  const snapshot = buildSnapshot({
    state: 'COMPLETE',
    goal: finishedGoal,
    plan,
    lastProviderId,
    totalRetries,
    durationMs,
    outcome,
    logs,
    recoveredFromFailures,
  })

  logs = appendObservabilityLog(snapshot.logs, {
    goal: finishedGoal.objective,
    activeTask: 'present',
    providerUsed: lastProviderId,
    retryCount: totalRetries,
    durationMs,
    outcome,
    state: 'COMPLETE',
    detail: `ok=${batch.okCount};failed=${batch.failedCount}`,
  })
  snapshot.logs = logs
  logAutonomousEvent(logs[logs.length - 1]!)

  emit({
    state: 'COMPLETE',
    phase: 'Completed',
    message: 'Autonomous execution complete',
    goalId: finishedGoal.id,
    completedTaskIds: snapshot.completedTaskIds,
    pendingTaskIds: snapshot.pendingTaskIds,
    providerId: lastProviderId ?? undefined,
    retryCount: totalRetries,
  })

  return {
    state: 'COMPLETE',
    snapshot,
    batch,
    toolResults,
    planBuilt: true,
    needsClarification: false,
    clarificationField: null,
    tripPlan,
  }
}

function buildSnapshot(input: {
  state: AutonomousAgentSnapshot['state']
  goal: AutonomousAgentSnapshot['goal']
  plan: AutonomousAgentSnapshot['plan']
  lastProviderId: string | null
  totalRetries: number
  durationMs: number
  outcome: AutonomousAgentSnapshot['outcome']
  logs: AutonomousObservabilityLog[]
  recoveredFromFailures: boolean
}): AutonomousAgentSnapshot {
  const completedTaskIds = input.plan ? completedTasks(input.plan).map((t) => t.id) : []
  const pendingTaskIds = input.plan ? pendingTasks(input.plan).map((t) => t.id) : []
  return {
    state: input.state,
    progressPhase: phaseForState(input.state),
    goal: input.goal,
    plan: input.plan,
    completedTaskIds,
    pendingTaskIds,
    lastProviderId: input.lastProviderId,
    totalRetries: input.totalRetries,
    durationMs: input.durationMs,
    outcome: input.outcome,
    logs: input.logs,
    recoveredFromFailures: input.recoveredFromFailures,
  }
}

function emptyBatch(): ToolExecutionBatch {
  return {
    results: [],
    selected: [],
    okCount: 0,
    failedCount: 0,
    durationMs: 0,
  }
}
