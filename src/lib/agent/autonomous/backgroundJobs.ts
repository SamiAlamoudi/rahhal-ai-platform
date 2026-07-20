/**
 * Background job store — long-running autonomous work can continue asynchronously
 * and stream progress to subscribers (UI).
 */

import type { AutonomousAgentSnapshot, AutonomousProgressEvent } from './types'

export type AutonomousJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface AutonomousJob {
  id: string
  conversationId: string
  status: AutonomousJobStatus
  createdAt: string
  updatedAt: string
  progress: AutonomousProgressEvent[]
  snapshot: AutonomousAgentSnapshot | null
  error: string | null
}

type ProgressListener = (event: AutonomousProgressEvent, job: AutonomousJob) => void

const jobs = new Map<string, AutonomousJob>()
const listeners = new Map<string, Set<ProgressListener>>()

export function createAutonomousJob(conversationId: string): AutonomousJob {
  const now = new Date().toISOString()
  const job: AutonomousJob = {
    id: `job:${conversationId}:${Date.now()}`,
    conversationId,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    progress: [],
    snapshot: null,
    error: null,
  }
  jobs.set(job.id, job)
  return job
}

export function getAutonomousJob(jobId: string): AutonomousJob | null {
  return jobs.get(jobId) ?? null
}

export function listAutonomousJobs(conversationId: string): AutonomousJob[] {
  return [...jobs.values()].filter((j) => j.conversationId === conversationId)
}

export function subscribeAutonomousJob(jobId: string, listener: ProgressListener): () => void {
  const set = listeners.get(jobId) ?? new Set()
  set.add(listener)
  listeners.set(jobId, set)
  return () => {
    set.delete(listener)
    if (set.size === 0) listeners.delete(jobId)
  }
}

export function publishAutonomousProgress(jobId: string, event: AutonomousProgressEvent): void {
  const job = jobs.get(jobId)
  if (!job) return
  job.progress.push(event)
  job.updatedAt = event.at
  if (job.status === 'queued') job.status = 'running'
  jobs.set(jobId, job)
  const set = listeners.get(jobId)
  if (set) {
    for (const listener of set) listener(event, job)
  }
}

export function completeAutonomousJob(
  jobId: string,
  snapshot: AutonomousAgentSnapshot,
  status: 'completed' | 'failed' = 'completed',
  error: string | null = null,
): AutonomousJob | null {
  const job = jobs.get(jobId)
  if (!job) return null
  job.status = status
  job.snapshot = snapshot
  job.error = error
  job.updatedAt = new Date().toISOString()
  jobs.set(jobId, job)
  return job
}

export function clearAutonomousJobs(): void {
  jobs.clear()
  listeners.clear()
}

/**
 * Run an async worker in the background while immediately returning the job handle.
 * Progress events are published to subscribers as the worker runs.
 */
export function runAutonomousJobInBackground(input: {
  conversationId: string
  worker: (publish: (event: AutonomousProgressEvent) => void) => Promise<AutonomousAgentSnapshot>
}): AutonomousJob {
  const job = createAutonomousJob(input.conversationId)
  job.status = 'running'
  jobs.set(job.id, job)

  void input.worker((event) => publishAutonomousProgress(job.id, event))
    .then((snapshot) => {
      completeAutonomousJob(
        job.id,
        snapshot,
        snapshot.outcome === 'failed' ? 'failed' : 'completed',
      )
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error ?? 'job_failed')
      completeAutonomousJob(job.id, {
        state: 'FAILED',
        progressPhase: 'Completed',
        goal: null,
        plan: null,
        completedTaskIds: [],
        pendingTaskIds: [],
        lastProviderId: null,
        totalRetries: 0,
        durationMs: 0,
        outcome: 'failed',
        logs: [],
        recoveredFromFailures: false,
      }, 'failed', message)
    })

  return job
}
