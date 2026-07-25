/**
 * Evolution Sprint 4 — DecisionFork
 * Records why a branch fork happened.
 */

import { isoNow, newId, type DecisionForkRecord } from './planningGraphTypes'

export function createDecisionFork(options: {
  fromNodeId: string
  toNodeIds: string[]
  reason: string
  evidence?: string[]
  now?: Date
}): DecisionForkRecord {
  return {
    id: newId('fork', options.now),
    fromNodeId: options.fromNodeId,
    toNodeIds: [...options.toNodeIds],
    reason: options.reason,
    evidence: [...(options.evidence ?? [])],
    timestamp: isoNow(options.now),
  }
}

export const DecisionFork = {
  create: createDecisionFork,
}
