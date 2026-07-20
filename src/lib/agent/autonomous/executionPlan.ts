/**
 * Multi-step execution plan — breaks travel work into trackable tasks.
 */

import type { AgentToolName } from '../tools/types'
import type { TripRequirements } from '../types'
import type {
  AutonomousExecutionPlan,
  AutonomousGoal,
  AutonomousTask,
  AutonomousTaskKind,
} from './types'

function taskId(kind: AutonomousTaskKind, index: number): string {
  return `task:${kind}:${index}`
}

function makeTask(
  kind: AutonomousTaskKind,
  title: string,
  index: number,
  tool?: AgentToolName,
  alternatives?: AgentToolName[],
): AutonomousTask {
  return {
    id: taskId(kind, index),
    kind,
    title,
    status: 'pending',
    tool,
    alternatives: alternatives?.length ? alternatives : undefined,
    retryCount: 0,
    maxRetries: 2,
  }
}

/**
 * Build an executable plan from the active goal + known requirements.
 * Soft preferences never spawn clarification tasks.
 */
export function buildExecutionPlan(input: {
  goal: AutonomousGoal
  requirements: TripRequirements
  missingCriticalFields: string[]
  locale: 'ar' | 'en'
  now?: Date
}): AutonomousExecutionPlan {
  const now = (input.now ?? new Date()).toISOString()
  const tasks: AutonomousTask[] = []
  let i = 0

  tasks.push(makeTask(
    'understand',
    input.locale === 'ar' ? 'فهم الهدف' : 'Understand the travel goal',
    i++,
  ))

  // At most one clarification task — only for a single critical blocker.
  if (input.missingCriticalFields.length === 1) {
    tasks.push(makeTask(
      'clarify',
      input.locale === 'ar'
        ? `توضيح: ${input.missingCriticalFields[0]}`
        : `Clarify: ${input.missingCriticalFields[0]}`,
      i++,
    ))
  } else if (input.missingCriticalFields.length === 0) {
    const dest = input.requirements.destination || input.requirements.destinations[0]
    const flightsOnly = input.requirements.packageScope === 'flights_only'

    if (dest || input.requirements.destinationFlexible) {
      tasks.push(makeTask('search_weather', 'Search weather', i++, 'weather'))
      if (!flightsOnly) {
        tasks.push(makeTask(
          'search_attractions',
          'Search attractions',
          i++,
          'attractions',
          ['maps'],
        ))
        tasks.push(makeTask('search_maps', 'Search maps / areas', i++, 'maps'))
      }
      tasks.push(makeTask(
        'search_flights',
        'Search flights',
        i++,
        'flights',
      ))
      if (!flightsOnly) {
        tasks.push(makeTask(
          'search_hotels',
          'Search hotels',
          i++,
          'hotels',
        ))
        tasks.push(makeTask(
          'search_transportation',
          'Search local transport',
          i++,
          'transportation',
        ))
      }
      if (
        input.requirements.budgetAmount != null
        || input.requirements.budgetCurrency
        || input.requirements.budgetFlexible
      ) {
        tasks.push(makeTask('search_currency', 'Normalize currency', i++, 'currency'))
      }
      if (dest && isLikelyInternational(dest)) {
        tasks.push(makeTask('search_visa', 'Check visa notes', i++, 'visa'))
      }
      tasks.push(makeTask(
        'compare_options',
        input.locale === 'ar' ? 'مقارنة الخيارات' : 'Compare options',
        i++,
      ))
      tasks.push(makeTask(
        'build_plan',
        input.locale === 'ar' ? 'بناء خطة الرحلة' : 'Build trip plan',
        i++,
      ))
    }
  }

  tasks.push(makeTask(
    'present',
    input.locale === 'ar' ? 'تقديم النتيجة' : 'Present result',
    i++,
  ))

  return {
    id: `plan:${input.goal.id}:${Date.now()}`,
    goalId: input.goal.id,
    tasks,
    createdAt: now,
    updatedAt: now,
  }
}

export function pendingTasks(plan: AutonomousExecutionPlan): AutonomousTask[] {
  return plan.tasks.filter((t) => t.status === 'pending' || t.status === 'running')
}

export function completedTasks(plan: AutonomousExecutionPlan): AutonomousTask[] {
  return plan.tasks.filter((t) => t.status === 'completed' || t.status === 'skipped')
}

export function markTaskRunning(plan: AutonomousExecutionPlan, taskId: string, now = new Date()): AutonomousExecutionPlan {
  return updateTask(plan, taskId, {
    status: 'running',
    startedAt: now.toISOString(),
  }, now)
}

export function markTaskCompleted(
  plan: AutonomousExecutionPlan,
  taskId: string,
  patch: Partial<AutonomousTask> = {},
  now = new Date(),
): AutonomousExecutionPlan {
  return updateTask(plan, taskId, {
    status: 'completed',
    finishedAt: now.toISOString(),
    ...patch,
  }, now)
}

export function markTaskFailed(
  plan: AutonomousExecutionPlan,
  taskId: string,
  error: string,
  now = new Date(),
): AutonomousExecutionPlan {
  return updateTask(plan, taskId, {
    status: 'failed',
    error,
    finishedAt: now.toISOString(),
  }, now)
}

export function markTaskSkipped(
  plan: AutonomousExecutionPlan,
  taskId: string,
  reason: string,
  now = new Date(),
): AutonomousExecutionPlan {
  return updateTask(plan, taskId, {
    status: 'skipped',
    error: reason,
    finishedAt: now.toISOString(),
  }, now)
}

function updateTask(
  plan: AutonomousExecutionPlan,
  taskId: string,
  patch: Partial<AutonomousTask>,
  now: Date,
): AutonomousExecutionPlan {
  return {
    ...plan,
    updatedAt: now.toISOString(),
    tasks: plan.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
  }
}

function isLikelyInternational(destination: string): boolean {
  const local = ['riyadh', 'jeddah', 'dammam', 'الرياض', 'جدة']
  const key = destination.trim().toLowerCase()
  return !local.some((city) => key.includes(city))
}
