/**
 * Sprint 84 — Plan Revision.
 * Update only affected parts when destination/dates/travelers/budget change.
 * Never rebuild the whole plan from scratch.
 */

import type {
  TravelPlan,
  TravelPlanExecutionStep,
  TravelPlanRevision,
  TravelPlanSlotKey,
  TravelPlanSlots,
} from './types'

/** Slots that trigger partial execution-step invalidation. */
const IMPACT: Record<string, string[]> = {
  destination: ['search_flights', 'search_hotels', 'build_itinerary', 'search_packages'],
  dates: ['search_flights', 'search_hotels', 'build_itinerary'],
  adults: ['search_flights', 'search_hotels', 'search_packages'],
  children: ['search_flights', 'search_hotels'],
  budget: ['rank_offers', 'search_packages'],
  origin: ['search_flights'],
  cabin: ['search_flights'],
  hotelPreference: ['search_hotels'],
}

export class PlanRevisionEngine {
  /**
   * Apply slot changes onto an existing plan skeleton.
   * Preserves planId, goal id, createdAt, unaffected execution steps.
   */
  revise(input: {
    plan: TravelPlan
    nextSlots: TravelPlanSlots
    changedSlots: TravelPlanSlotKey[]
    note?: string
  }): TravelPlan {
    const { plan, nextSlots, changedSlots } = input
    if (changedSlots.length === 0) return plan

    const revision: TravelPlanRevision = {
      at: new Date().toISOString(),
      changedSlots: [...changedSlots],
      note: input.note ?? `Revised slots: ${changedSlots.join(', ')}`,
    }

    const affectedStepIds = new Set<string>()
    for (const slot of changedSlots) {
      for (const stepId of IMPACT[slot] ?? []) affectedStepIds.add(stepId)
    }

    const executionSteps: TravelPlanExecutionStep[] = plan.executionSteps.map((step) => {
      if (!affectedStepIds.has(step.id)) return step
      // Reset only affected steps — do not rebuild the whole step list.
      return {
        ...step,
        status: step.status === 'done' || step.status === 'ready' ? 'pending' : step.status,
      }
    })

    const plannerNotes = [
      ...plan.plannerNotes,
      revision.note,
    ].slice(-20)

    return {
      ...plan,
      knownSlots: nextSlots,
      executionSteps,
      plannerNotes,
      revisions: [...plan.revisions, revision],
      updatedAt: revision.at,
      // Itinerary regenerated later only if structure inputs changed.
      itinerary:
        changedSlots.some((s) =>
          s === 'destination' || s === 'dates' || s === 'origin' || s === 'activities',
        )
          ? null
          : plan.itinerary,
    }
  }
}

export function createPlanRevisionEngine(): PlanRevisionEngine {
  return new PlanRevisionEngine()
}

export function createDefaultExecutionSteps(): TravelPlanExecutionStep[] {
  return [
    {
      id: 'collect_slots',
      label: 'Collect required planning slots',
      status: 'ready',
      dependsOn: [],
    },
    {
      id: 'search_flights',
      label: 'Search flights (deferred — no providers in Sprint 84)',
      status: 'blocked',
      dependsOn: ['collect_slots'],
    },
    {
      id: 'search_hotels',
      label: 'Search hotels (deferred — no providers in Sprint 84)',
      status: 'blocked',
      dependsOn: ['collect_slots'],
    },
    {
      id: 'search_packages',
      label: 'Search packages (deferred — no providers in Sprint 84)',
      status: 'blocked',
      dependsOn: ['collect_slots'],
    },
    {
      id: 'rank_offers',
      label: 'Rank offers (deferred)',
      status: 'blocked',
      dependsOn: ['search_flights', 'search_hotels'],
    },
    {
      id: 'build_itinerary',
      label: 'Build itinerary skeleton',
      status: 'pending',
      dependsOn: ['collect_slots'],
    },
  ]
}
