/**
 * Phase 6 — TaskQueue
 * Priority-ordered runnable tasks (urgent first).
 */

import type { MissionTask, PriorityLevel } from './types'

const PRIORITY_RANK: Record<PriorityLevel, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  deferred: 3,
}

export function sortByPriority(tasks: MissionTask[]): MissionTask[] {
  return [...tasks].sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    if (pr !== 0) return pr
    return a.id.localeCompare(b.id)
  })
}

export function nextRunnableTask(
  tasks: MissionTask[],
  completedIds: string[],
): MissionTask | null {
  const done = new Set(completedIds)
  const runnable = tasks.filter((t) => {
    if (done.has(t.id)) return false
    if (t.status === 'skipped' || t.status === 'cancelled') return false
    return t.dependsOn.every((d) => done.has(d))
  })
  return sortByPriority(runnable)[0] ?? null
}

/** What is urgent vs what can wait / be asked now. */
export function prioritizeClarifications(tasks: MissionTask[]): {
  askNow: string[]
  delay: string[]
} {
  const askNow: string[] = []
  const delay: string[] = []
  for (const t of sortByPriority(tasks)) {
    if (!t.unblockQuestion) continue
    if (t.priority === 'urgent' || t.priority === 'high') askNow.push(t.unblockQuestion)
    else delay.push(t.unblockQuestion)
  }
  return { askNow: askNow.slice(0, 1), delay }
}

export const TaskQueue = {
  sortByPriority,
  nextRunnable: nextRunnableTask,
  prioritizeClarifications,
}
