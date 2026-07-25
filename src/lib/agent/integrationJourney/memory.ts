/**
 * Integration Sprint 12 — cross-module journey memory (no duplicated questions).
 */

import type { JourneyMemorySnapshot, JourneyScenario, JourneyStageId } from './types'

const store = new Map<string, JourneyMemorySnapshot>()

function empty(scenario: JourneyScenario = 'leisure'): JourneyMemorySnapshot {
  return {
    stage: 'conversation',
    scenario,
    knownSlots: [],
    previousDecisions: [],
    completedStages: [],
    turn: 0,
  }
}

export function readJourneyMemory(userId?: string | null): JourneyMemorySnapshot {
  if (!userId) return empty()
  const existing = store.get(userId)
  if (!existing) return empty()
  return {
    ...existing,
    knownSlots: [...existing.knownSlots],
    previousDecisions: [...existing.previousDecisions],
    completedStages: [...existing.completedStages],
  }
}

export function writeJourneyMemory(
  userId: string | null | undefined,
  next: JourneyMemorySnapshot,
): JourneyMemorySnapshot {
  const key = userId ?? 'anonymous'
  const stored: JourneyMemorySnapshot = {
    ...next,
    knownSlots: unique(next.knownSlots).slice(0, 24),
    previousDecisions: next.previousDecisions.slice(-16),
    completedStages: uniqueStages(next.completedStages),
  }
  store.set(key, stored)
  return readJourneyMemory(key)
}

export function resetJourneyMemoryForTests(): void {
  store.clear()
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

function uniqueStages(values: JourneyStageId[]): JourneyStageId[] {
  const seen = new Set<JourneyStageId>()
  const out: JourneyStageId[] = []
  for (const v of values) {
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}
