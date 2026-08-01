/**
 * Sprint 84 — Planning recovery.
 * Resume unfinished planning / interrupted conversations; reuse prior context.
 */

import type { TravelPlan } from './types'

export class PlanningRecovery {
  /** True when a prior plan should be resumed rather than created fresh. */
  shouldResume(prior: TravelPlan | null | undefined, interrupted?: boolean): boolean {
    if (!prior) return false
    // Terminal plans only resume when explicitly interrupted / re-opened.
    if (
      prior.completionStatus === 'completed'
      || prior.conversationState === 'Completed'
    ) {
      return Boolean(interrupted)
    }
    if (prior.conversationState === 'Cancelled' || prior.completionStatus === 'cancelled') {
      return Boolean(interrupted)
    }
    // Any provided non-terminal priorPlan is a continuation (revision / slot-fill).
    return true
  }

  /**
   * Prepare a recovered plan snapshot (preserves ids + known slots).
   * Does not ask providers; only marks recovery metadata.
   */
  recover(prior: TravelPlan): TravelPlan {
    const ts = new Date().toISOString()
    return {
      ...prior,
      conversationState: 'Recovered',
      plannerNotes: [
        ...prior.plannerNotes,
        `Recovered planning session at ${ts}`,
      ].slice(-20),
      updatedAt: ts,
      goal: {
        ...prior.goal,
        status: 'active',
        updatedAt: ts,
      },
    }
  }
}

export function createPlanningRecovery(): PlanningRecovery {
  return new PlanningRecovery()
}
