/**
 * Dialogue phase machine for the AI Concierge.
 * Pure functions over agent memory + Concierge state — no provider knowledge.
 */

import type { AgentIntent, AgentMemory, TripRequirements } from '../agent/types'
import {
  emptyConciergeState,
  type ConciergePhase,
  type ConciergeState,
  type ConciergeSoftSignals,
} from './types'

const HARD_INTAKE: Array<keyof TripRequirements> = [
  'destination',
  'durationDays',
  'budgetAmount',
  'travelers',
]

export function mergeSoftSignals(
  base: ConciergeSoftSignals,
  patch: Partial<ConciergeSoftSignals>,
): ConciergeSoftSignals {
  return {
    pace: patch.pace ?? base.pace,
    mustHaves: uniqueStrings([...(patch.mustHaves ?? []), ...base.mustHaves]),
    dealBreakers: uniqueStrings([...(patch.dealBreakers ?? []), ...base.dealBreakers]),
    flexibleDimensions: uniqueStrings([
      ...(patch.flexibleDimensions ?? []),
      ...base.flexibleDimensions,
    ]),
    tradeoffs: uniqueStrings([...(patch.tradeoffs ?? []), ...base.tradeoffs]),
    notes: uniqueStrings([...(patch.notes ?? []), ...base.notes]),
  }
}

export function hardMissingCount(missingFields: Array<keyof TripRequirements>): number {
  return missingFields.filter((field) => HARD_INTAKE.includes(field)).length
}

export function hasSoftDepth(signals: ConciergeSoftSignals): boolean {
  return Boolean(
    signals.pace
    || signals.mustHaves.length > 0
    || signals.dealBreakers.length > 0
    || signals.tradeoffs.length > 0
    || signals.flexibleDimensions.length > 0,
  )
}

/**
 * Resolve the next Concierge phase from agent memory + prior Concierge state.
 * Intentional consultant progression — not provider orchestration.
 */
export function resolveConciergePhase(input: {
  memory: AgentMemory
  previous: ConciergeState | null
  intent: AgentIntent
  softSignals: ConciergeSoftSignals
}): ConciergePhase {
  const prev = input.previous ?? emptyConciergeState()
  const { memory, intent, softSignals } = input
  const hardMissing = hardMissingCount(memory.missingFields)
  const hasPlan = Boolean(memory.tripPlan)

  if (hasPlan && (intent === 'edit' || intent === 'regenerate' || intent === 'regenerate_day')) {
    return 'refining'
  }
  if (hasPlan && intent === 'save') {
    return 'refining'
  }
  if (hasPlan && hardMissing === 0 && (intent === 'plan' || intent === 'answer' || intent === 'unknown')) {
    return prev.phase === 'confirming' || prev.phase === 'executing' ? 'executing' : 'refining'
  }

  if (prev.turnCount === 0 && hardMissing >= HARD_INTAKE.length) {
    return 'greeting'
  }

  if (hardMissing > 0) {
    const filledHard = HARD_INTAKE.length - hardMissing
    if (filledHard === 0) return 'discovery'
    if (filledHard < HARD_INTAKE.length) return 'deepening'
  }

  // Hard requirements satisfied — deepen soft signals or advise/confirm.
  if (!hasSoftDepth(softSignals) && prev.phase !== 'advising' && prev.phase !== 'confirming') {
    return 'deepening'
  }

  if (prev.phase === 'confirming') return 'confirming'
  if (prev.phase === 'advising' || hasSoftDepth(softSignals)) return 'advising'

  return 'deepening'
}

export function advanceConciergeState(input: {
  previous: ConciergeState | null
  phase: ConciergePhase
  softSignals?: ConciergeSoftSignals
  lastAction?: ConciergeState['lastAction']
  heardSummary?: string[]
}): ConciergeState {
  const prev = input.previous ?? emptyConciergeState()
  return {
    phase: input.phase,
    softSignals: input.softSignals ?? prev.softSignals,
    lastAction: input.lastAction ?? prev.lastAction,
    heardSummary: input.heardSummary ?? prev.heardSummary,
    turnCount: prev.turnCount + 1,
  }
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value.trim())
  }
  return out
}
