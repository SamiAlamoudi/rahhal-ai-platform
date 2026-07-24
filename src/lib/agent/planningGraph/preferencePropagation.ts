/**
 * Evolution Sprint 4 — PreferencePropagation
 * Propagate traveler preferences / soft profile along branches.
 */

import { clamp01, uniqueStrings, type PlanNodeData } from './planningGraphTypes'

export function propagatePreferences(
  parent: PlanNodeData,
  child: PlanNodeData,
): PlanNodeData {
  const interests = uniqueStrings([
    ...parent.travelerProfile.interests,
    ...child.travelerProfile.interests,
  ])
  const styleNotes = uniqueStrings([
    ...parent.travelerProfile.styleNotes,
    ...child.travelerProfile.styleNotes,
  ])
  return {
    ...child,
    travelerProfile: {
      purpose: child.travelerProfile.purpose ?? parent.travelerProfile.purpose,
      pace: child.travelerProfile.pace ?? parent.travelerProfile.pace,
      budgetStance: child.travelerProfile.budgetStance ?? parent.travelerProfile.budgetStance,
      riskTolerance: child.travelerProfile.riskTolerance ?? parent.travelerProfile.riskTolerance,
      partySize: child.travelerProfile.partySize ?? parent.travelerProfile.partySize,
      interests,
      styleNotes,
    },
    assumptions: uniqueStrings([...parent.assumptions, ...child.assumptions]),
    tradeoffs: uniqueStrings([...parent.tradeoffs, ...child.tradeoffs]),
  }
}

/** Confidence evolves toward parent when child is under-specified. */
export function propagateConfidence(parent: PlanNodeData, child: PlanNodeData): number {
  if (child.missingData.length === 0 && child.destinations.length > 0) {
    return clamp01(Math.max(child.confidence, parent.confidence * 0.9))
  }
  // Blend: child keeps agency but inherits stability from parent.
  return clamp01(child.confidence * 0.7 + parent.confidence * 0.3)
}

export const PreferencePropagation = {
  propagate: propagatePreferences,
  confidence: propagateConfidence,
}
