/**
 * Phase 6 — ExecutionMemory
 * Conversation + preference + task + profile memory for the mission.
 */

import type { ExecutionMemorySnapshot, MissionTask, TravelGoal } from './types'

export function emptyExecutionMemory(): ExecutionMemorySnapshot {
  return {
    conversationFacts: [],
    preferenceFacts: [],
    taskFacts: [],
    profileFacts: [],
    goalVersions: [],
  }
}

function uniq(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const key = v.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(v.trim())
  }
  return out
}

export function updateExecutionMemory(input: {
  prior?: ExecutionMemorySnapshot | null
  goal: TravelGoal
  tasks: MissionTask[]
  userText: string
  completedIds: string[]
}): ExecutionMemorySnapshot {
  const prior = input.prior ?? emptyExecutionMemory()
  const conversationFacts = uniq([
    ...prior.conversationFacts,
    input.userText.trim().slice(0, 160),
  ]).slice(-12)

  const preferenceFacts = uniq([
    ...prior.preferenceFacts,
    ...(input.goal.purpose ? [`purpose=${input.goal.purpose}`] : []),
    ...(input.goal.notes.map((n) => `note=${n}`)),
  ])

  const taskFacts = uniq([
    ...prior.taskFacts,
    ...input.tasks
      .filter((t) => input.completedIds.includes(t.id))
      .map((t) => `${t.kind}=done`),
  ]).slice(-20)

  const profileFacts = uniq([
    ...prior.profileFacts,
    ...(input.goal.travelers != null ? [`travelers=${input.goal.travelers}`] : []),
    ...(input.goal.currency ? [`currency=${input.goal.currency}`] : []),
  ])

  const goalVersions = [...prior.goalVersions, input.goal].slice(-8)

  return {
    conversationFacts,
    preferenceFacts,
    taskFacts,
    profileFacts,
    goalVersions,
  }
}

export const ExecutionMemory = {
  empty: emptyExecutionMemory,
  update: updateExecutionMemory,
}
