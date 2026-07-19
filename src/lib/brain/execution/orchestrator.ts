/**
 * Sprint 23 — ExecutionOrchestrator
 * sequential / dependency-aware / parallel-safe / cancel / retry / timeout / partial success
 */

import type { TripPlan as EngineTripPlan } from '../tripPlanning/types'
import { createMockExecutionProviders } from './providers'
import {
  buildExecutionTasksFromTripPlan,
  createExecutionPlan,
} from './taskBuilder'
import type {
  ExecutionPlan,
  ExecutionProgress,
  ExecutionProviderBundle,
  ExecutionResult,
  ExecutionState,
  ExecutionSummary,
  ExecutionTask,
  ExecutionTaskType,
  TravelExecutionTurnResult,
} from './types'

export type ExecutionOrchestratorOptions = {
  providers?: Partial<ExecutionProviderBundle>
  maxRetries?: number
  defaultTimeoutMs?: number
  /** When true, run ready tasks in parallel waves (still respects dependencies). */
  parallelSafe?: boolean
}

function nowIso(): string {
  return new Date().toISOString()
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  )
}

function computeProgress(tasks: ExecutionTask[], currentTaskId: string | null): ExecutionProgress {
  const total = tasks.length
  const completed = tasks.filter((t) => t.status === 'completed').length
  const failed = tasks.filter((t) => t.status === 'failed' || t.status === 'timed_out').length
  const cancelled = tasks.filter((t) => t.status === 'cancelled').length
  const skipped = tasks.filter((t) => t.status === 'skipped').length
  const running = tasks.filter((t) => t.status === 'running').length
  const pending = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'queued',
  ).length
  const done = completed + failed + cancelled + skipped
  return {
    total,
    completed,
    failed,
    cancelled,
    skipped,
    running,
    pending,
    ratio: total === 0 ? 1 : done / total,
    currentTaskId,
  }
}

function summarize(
  plan: ExecutionPlan,
  results: ExecutionResult[],
  durationMs: number,
): ExecutionSummary {
  const progress = computeProgress(plan.tasks, null)
  const successfulTypes = results.filter((r) => r.success).map((r) => r.type)
  const failedTypes = results.filter((r) => !r.success).map((r) => r.type)
  const partialSuccess =
    successfulTypes.length > 0 && (failedTypes.length > 0 || progress.cancelled > 0)

  let headline = 'Execution idle'
  if (plan.state === 'completed') headline = 'Execution completed'
  else if (plan.state === 'partial') headline = 'Execution finished with partial success'
  else if (plan.state === 'failed') headline = 'Execution failed'
  else if (plan.state === 'cancelled') headline = 'Execution cancelled'
  else if (plan.state === 'running') headline = 'Execution running'

  return {
    planId: plan.id,
    state: plan.state,
    progress,
    results: [...results],
    successfulTypes,
    failedTypes,
    partialSuccess,
    durationMs,
    headline,
  }
}

function depsSatisfied(task: ExecutionTask, tasks: ExecutionTask[]): boolean {
  return task.dependencies.every((depId) => {
    const dep = tasks.find((t) => t.id === depId)
    if (!dep) return true
    return dep.status === 'completed' || dep.status === 'skipped'
  })
}

function depsFailed(task: ExecutionTask, tasks: ExecutionTask[]): boolean {
  return task.dependencies.some((depId) => {
    const dep = tasks.find((t) => t.id === depId)
    return (
      dep &&
      (dep.status === 'failed' ||
        dep.status === 'timed_out' ||
        dep.status === 'cancelled')
    )
  })
}

/**
 * ExecutionOrchestrator — runs an ExecutionPlan against provider adapters.
 */
export function ExecutionOrchestrator(options: ExecutionOrchestratorOptions = {}) {
  const providers: ExecutionProviderBundle = {
    ...createMockExecutionProviders(),
    ...options.providers,
  }
  const maxRetries = options.maxRetries ?? 1
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 2000
  const parallelSafe = options.parallelSafe !== false

  let abortController: AbortController | null = null

  const cancel = (): void => {
    abortController?.abort()
  }

  const buildPlan = (input: {
    conversationId: string
    tripPlan: EngineTripPlan
  }): ExecutionPlan => {
    const tasks = buildExecutionTasksFromTripPlan(input.tripPlan, {
      maxRetries,
      defaultTimeoutMs,
    })
    return createExecutionPlan({
      conversationId: input.conversationId,
      tripPlan: input.tripPlan,
      tasks,
    })
  }

  const runTaskOnce = async (
    task: ExecutionTask,
    tripPlan: EngineTripPlan,
    signal: AbortSignal,
  ): Promise<{ data: unknown; providerId: string }> => {
    const ctx = { task, tripPlan, signal }
    switch (task.type) {
      case 'flight_search':
        return { data: await providers.flights.search(ctx), providerId: providers.flights.id }
      case 'hotel_search':
        return { data: await providers.hotels.search(ctx), providerId: providers.hotels.id }
      case 'transport_search':
        return { data: await providers.transport.search(ctx), providerId: providers.transport.id }
      case 'activities_search':
        return {
          data: await providers.activities.search(ctx),
          providerId: providers.activities.id,
        }
      case 'package_search':
        return { data: await providers.packages.search(ctx), providerId: providers.packages.id }
      default: {
        const _exhaustive: never = task.type
        throw new Error(`Unknown task type: ${_exhaustive}`)
      }
    }
  }

  const executeTask = async (
    task: ExecutionTask,
    tripPlan: EngineTripPlan,
    signal: AbortSignal,
  ): Promise<ExecutionResult> => {
    const started = Date.now()
    task.status = 'running'
    task.startedAt = nowIso()
    task.error = null

    let lastError: string | null = null

    while (task.retryCount <= task.maxRetries) {
      if (signal.aborted) {
        task.status = 'cancelled'
        task.finishedAt = nowIso()
        return {
          taskId: task.id,
          type: task.type,
          status: 'cancelled',
          success: false,
          durationMs: Date.now() - started,
          retryCount: task.retryCount,
          data: null,
          error: 'cancelled',
          providerId: 'none',
        }
      }

      const timeoutController = new AbortController()
      const onAbort = () => timeoutController.abort()
      signal.addEventListener('abort', onAbort, { once: true })
      const timer = setTimeout(() => timeoutController.abort(), task.timeoutMs)

      try {
        const { data, providerId } = await runTaskOnce(task, tripPlan, timeoutController.signal)
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        task.status = 'completed'
        task.finishedAt = nowIso()
        return {
          taskId: task.id,
          type: task.type,
          status: 'completed',
          success: true,
          durationMs: Date.now() - started,
          retryCount: task.retryCount,
          data,
          error: null,
          providerId,
        }
      } catch (err) {
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        if (signal.aborted) {
          task.status = 'cancelled'
          task.finishedAt = nowIso()
          return {
            taskId: task.id,
            type: task.type,
            status: 'cancelled',
            success: false,
            durationMs: Date.now() - started,
            retryCount: task.retryCount,
            data: null,
            error: 'cancelled',
            providerId: 'none',
          }
        }
        const timedOut = isAbortError(err)
        lastError = timedOut
          ? `timeout after ${task.timeoutMs}ms`
          : err instanceof Error
            ? err.message
            : String(err)
        if (task.retryCount < task.maxRetries) {
          task.retryCount += 1
          continue
        }
        task.status = timedOut ? 'timed_out' : 'failed'
        task.error = lastError
        task.finishedAt = nowIso()
        return {
          taskId: task.id,
          type: task.type,
          status: task.status,
          success: false,
          durationMs: Date.now() - started,
          retryCount: task.retryCount,
          data: null,
          error: lastError,
          providerId: 'none',
        }
      }
    }

    task.status = 'failed'
    task.error = lastError ?? 'unknown'
    task.finishedAt = nowIso()
    return {
      taskId: task.id,
      type: task.type,
      status: 'failed',
      success: false,
      durationMs: Date.now() - started,
      retryCount: task.retryCount,
      data: null,
      error: task.error,
      providerId: 'none',
    }
  }

  const run = async (input: {
    conversationId: string
    tripPlan: EngineTripPlan
    signal?: AbortSignal
    plan?: ExecutionPlan
  }): Promise<TravelExecutionTurnResult> => {
    const startedAt = Date.now()
    abortController = new AbortController()
    if (input.signal) {
      if (input.signal.aborted) abortController.abort()
      else {
        input.signal.addEventListener(
          'abort',
          () => abortController?.abort(),
          { once: true },
        )
      }
    }
    const signal = abortController.signal

    const plan =
      input.plan ??
      buildPlan({ conversationId: input.conversationId, tripPlan: input.tripPlan })
    plan.state = 'running'
    plan.cancelled = false
    plan.updatedAt = nowIso()

    const results: ExecutionResult[] = []

    // Mark already-skipped
    for (const task of plan.tasks) {
      if (task.status === 'skipped') {
        results.push({
          taskId: task.id,
          type: task.type,
          status: 'skipped',
          success: true,
          durationMs: 0,
          retryCount: 0,
          data: { skipped: true },
          error: null,
          providerId: 'skip',
        })
      }
    }

    const remaining = () =>
      plan.tasks.filter(
        (t) =>
          t.status === 'pending' ||
          t.status === 'queued' ||
          t.status === 'running',
      )

    while (remaining().length > 0) {
      if (signal.aborted) {
        for (const t of plan.tasks) {
          if (t.status === 'pending' || t.status === 'queued') {
            t.status = 'cancelled'
            t.finishedAt = nowIso()
            results.push({
              taskId: t.id,
              type: t.type,
              status: 'cancelled',
              success: false,
              durationMs: 0,
              retryCount: t.retryCount,
              data: null,
              error: 'cancelled',
              providerId: 'none',
            })
          }
        }
        plan.state = 'cancelled'
        plan.cancelled = true
        break
      }

      // Skip tasks whose deps failed
      for (const task of plan.tasks) {
        if (task.status !== 'pending' && task.status !== 'queued') continue
        if (depsFailed(task, plan.tasks)) {
          task.status = 'skipped'
          task.finishedAt = nowIso()
          task.error = 'dependency_failed'
          results.push({
            taskId: task.id,
            type: task.type,
            status: 'skipped',
            success: false,
            durationMs: 0,
            retryCount: 0,
            data: { skipped: true, reason: 'dependency_failed' },
            error: 'dependency_failed',
            providerId: 'skip',
          })
        }
      }

      const ready = plan.tasks
        .filter((t) => t.status === 'pending' || t.status === 'queued')
        .filter((t) => depsSatisfied(t, plan.tasks))
        .sort((a, b) => b.priority - a.priority)

      if (ready.length === 0) {
        // Deadlock / nothing runnable
        for (const t of plan.tasks) {
          if (t.status === 'pending' || t.status === 'queued') {
            t.status = 'skipped'
            t.error = 'unsatisfiable_dependencies'
            t.finishedAt = nowIso()
            results.push({
              taskId: t.id,
              type: t.type,
              status: 'skipped',
              success: false,
              durationMs: 0,
              retryCount: 0,
              data: null,
              error: 'unsatisfiable_dependencies',
              providerId: 'skip',
            })
          }
        }
        break
      }

      const wave = parallelSafe ? ready : [ready[0]]
      for (const t of wave) t.status = 'queued'

      const waveResults = await Promise.all(
        wave.map((task) => executeTask(task, input.tripPlan, signal)),
      )
      results.push(...waveResults)
      plan.updatedAt = nowIso()
    }

    const progress = computeProgress(plan.tasks, null)
    let state: ExecutionState = 'completed'
    if (plan.cancelled || signal.aborted) state = 'cancelled'
    else if (progress.failed > 0 && progress.completed > 0) state = 'partial'
    else if (progress.failed > 0 && progress.completed === 0) state = 'failed'
    else if (progress.completed + progress.skipped === progress.total) state = 'completed'
    else state = 'partial'

    plan.state = state
    plan.updatedAt = nowIso()

    const summary = summarize(plan, results, Date.now() - startedAt)
    return {
      plan: {
        ...plan,
        tasks: plan.tasks.map((t) => ({ ...t, dependencies: [...t.dependencies] })),
      },
      summary,
      results: [...results],
      progress: summary.progress,
      state,
    }
  }

  return {
    buildPlan,
    run,
    cancel,
    getProviders: () => providers,
  }
}

export type ExecutionOrchestratorHandle = ReturnType<typeof ExecutionOrchestrator>

export function taskTypesInOrder(): ExecutionTaskType[] {
  return [
    'flight_search',
    'hotel_search',
    'transport_search',
    'activities_search',
    'package_search',
  ]
}
