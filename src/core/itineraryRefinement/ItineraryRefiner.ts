/**
 * Sprint 84 — Autonomous Itinerary Refinement Engine (incremental).
 */

import type { PackageCandidate } from '../packageBuilder/PackageCandidate'
import { balanceActivities } from './ActivityBalancer'
import { generateAlternatives, type RefinementAlternative } from './AlternativeGenerator'
import { detectConflicts, type RefinementConflict } from './ConflictDetector'
import {
  resolveConstraints,
  type HardConstraintKind,
  type SoftConstraintKind,
} from './ConstraintResolver'
import { buildRefinementExplanation, type RefinementExplanation } from './ExplanationBuilder'
import { planRefinement, type RefinementChangeKind } from './RefinementPlanner'
import { analyzeRefinementRisk, refinementConfidence } from './RiskAnalyzer'
import { optimizeSchedule } from './ScheduleOptimizer'
import { optimizeTransfers } from './TransferOptimizer'
import { emitRefinementEvent, type RefinementEvent } from './events'

export const SPRINT84_ITINERARY_REFINEMENT_VERSION = '1.0.0-itinerary-refinement'

export interface RefinementLearningSignal {
  kind: string
  value: string
  polarity: 'prefer' | 'avoid'
  source: 'accepted_recommendation' | 'rejected_recommendation' | 'user_correction'
}

export interface RefinementRequest {
  package: PackageCandidate
  userText?: string | null
  changes?: RefinementChangeKind[]
  hardConstraints?: Partial<Record<HardConstraintKind, unknown>>
  softConstraints?: Partial<Record<SoftConstraintKind, unknown>>
  budgetCap?: number | null
  hasChildren?: boolean
  meetings?: Array<{ at: string; title: string }>
  /** When traveler accepts/rejects a refinement alternative. */
  outcome?: 'accepted' | 'rejected' | null
}

export interface RefinementResult {
  version: string
  refined: PackageCandidate
  impactedComponents: string[]
  reusedComponents: string[]
  changesApplied: RefinementChangeKind[]
  conflicts: RefinementConflict[]
  alternatives: RefinementAlternative[]
  explanation: RefinementExplanation
  learningSignals: RefinementLearningSignal[]
  confidence: number
  incremental: boolean
  durationMs: number
  events: RefinementEvent[]
}

function learningFromChanges(
  changes: RefinementChangeKind[],
  outcome: 'accepted' | 'rejected' | null | undefined,
): RefinementLearningSignal[] {
  const polarity = outcome === 'rejected' ? 'avoid' : 'prefer'
  const source = outcome === 'rejected'
    ? 'rejected_recommendation' as const
    : outcome === 'accepted'
      ? 'accepted_recommendation' as const
      : 'user_correction' as const
  const signals: RefinementLearningSignal[] = []
  if (changes.includes('luxury_upgrade')) {
    signals.push({ kind: 'luxury_vs_value', value: 'luxury', polarity, source })
  }
  if (changes.includes('economy_downgrade')) {
    signals.push({ kind: 'luxury_vs_value', value: 'value', polarity, source })
  }
  if (changes.includes('halal_food')) {
    signals.push({ kind: 'food', value: 'halal', polarity: 'prefer', source })
  }
  if (changes.includes('child_traveler')) {
    signals.push({ kind: 'family_pattern', value: 'family', polarity: 'prefer', source })
  }
  if (changes.includes('no_early_flights')) {
    signals.push({ kind: 'departure_time', value: 'morning', polarity: 'avoid', source })
  }
  if (changes.includes('accessibility')) {
    signals.push({ kind: 'booking_habit', value: 'accessibility', polarity: 'prefer', source })
  }
  return signals
}

export class ItineraryRefiner {
  refine(request: RefinementRequest): RefinementResult {
    const started = performance.now()
    const events: RefinementEvent[] = []
    emitRefinementEvent('refinement.started', {
      packageId: request.package.id,
    }, events)

    const plan = planRefinement({
      userText: request.userText,
      changes: request.changes,
    })
    emitRefinementEvent('refinement.planned', {
      changes: plan.changes,
      impactedKinds: plan.impactedKinds,
    }, events)

    const costBefore = request.package.totalPrice
    const originalIds = new Set(request.package.components.map((c) => c.id))

    // Incremental path: clone once, touch only impacted kinds via resolvers.
    let working: PackageCandidate = {
      ...request.package,
      components: request.package.components.map((c) => ({ ...c, payload: { ...c.payload } })),
    }

    const touched = new Set<string>()

    const resolved = resolveConstraints({
      pkg: working,
      changes: plan.changes,
      budgetCap: request.budgetCap,
      hasChildren: request.hasChildren,
      hard: request.hardConstraints,
      soft: request.softConstraints,
    })
    working = resolved.pkg
    for (const id of resolved.touchedIds) touched.add(id)

    if (
      plan.changes.includes('transfer_optimization')
      || plan.impactedKinds.includes('transfer')
      || plan.changes.includes('late_arrival')
      || plan.changes.includes('flight_change')
    ) {
      const xfer = optimizeTransfers(working)
      working = xfer.pkg
      for (const id of xfer.touchedIds) touched.add(id)
    }

    if (
      plan.impactedKinds.includes('activity')
      || plan.changes.includes('meeting_insertion')
      || plan.changes.includes('extra_day')
      || plan.changes.includes('late_arrival')
      || plan.changes.includes('early_departure')
    ) {
      const balanced = balanceActivities(working)
      working = balanced.pkg
      for (const id of balanced.touchedIds) touched.add(id)
      const scheduled = optimizeSchedule(working)
      working = scheduled.pkg
      for (const id of scheduled.touchedIds) touched.add(id)
    }

    let conflicts = detectConflicts(working, {
      budgetCap: request.budgetCap,
      meetings: request.meetings,
      maxWalkMinutes: typeof request.softConstraints?.walking_distance === 'number'
        ? Number(request.softConstraints.walking_distance)
        : 35,
    })
    for (const c of conflicts) {
      emitRefinementEvent('refinement.conflict', { code: c.code, severity: c.severity }, events)
    }

    // Auto-resolve soft duplicate activities incrementally
    if (conflicts.some((c) => c.code === 'duplicate_activity')) {
      const seen = new Set<string>()
      working = {
        ...working,
        components: working.components.filter((c) => {
          if (c.kind !== 'activity') return true
          const key = c.title.toLowerCase()
          if (seen.has(key)) {
            touched.add(c.id)
            return false
          }
          seen.add(key)
          return true
        }),
      }
      working.totalPrice = working.components.reduce((s, c) => s + c.price, 0)
      conflicts = detectConflicts(working, {
        budgetCap: request.budgetCap,
        meetings: request.meetings,
      })
    }

    emitRefinementEvent('refinement.optimized', {
      touched: touched.size,
      conflicts: conflicts.length,
    }, events)

    const alternatives = conflicts.some((c) => c.severity === 'hard')
      ? generateAlternatives({ base: working, conflicts, events })
      : []

    // If hard conflicts remain and we have Option B, prefer B as refined schedule shift.
    const hardLeft = conflicts.filter((c) => c.severity === 'hard')
    if (hardLeft.length > 0 && alternatives[1]) {
      working = alternatives[1]!.package
      conflicts = detectConflicts(working, { budgetCap: request.budgetCap, meetings: request.meetings })
    }

    const risk = analyzeRefinementRisk(working, conflicts)
    const confidence = refinementConfidence(working, conflicts, true)
    const impactedComponents = [...touched]
    const reusedComponents = [...originalIds].filter((id) => !touched.has(id))

    const explanation = buildRefinementExplanation({
      changes: plan.changes,
      impactedComponents,
      reusedComponents,
      conflicts,
      alternatives,
      risk,
      confidence,
      costBefore,
      costAfter: working.totalPrice,
      currency: working.currency,
    })

    const learningSignals = learningFromChanges(plan.changes, request.outcome)

    const durationMs = Math.round((performance.now() - started) * 100) / 100
    emitRefinementEvent('refinement.completed', {
      packageId: working.id,
      confidence,
      durationMs,
      incremental: true,
    }, events)

    return {
      version: SPRINT84_ITINERARY_REFINEMENT_VERSION,
      refined: working,
      impactedComponents,
      reusedComponents,
      changesApplied: plan.changes,
      conflicts,
      alternatives,
      explanation,
      learningSignals,
      confidence,
      incremental: true,
      durationMs,
      events,
    }
  }
}

export function createItineraryRefiner(): ItineraryRefiner {
  return new ItineraryRefiner()
}

export function runItineraryRefinement(request: RefinementRequest): RefinementResult {
  return createItineraryRefiner().refine(request)
}
