/**
 * Evolution Sprint 4 — PlanVersion
 * Append-only version history for plan nodes.
 */

import { isoNow, type PlanNodeData, type PlanVersionRecord } from './planningGraphTypes'

export function recordPlanVersion(
  node: PlanNodeData,
  reason: string,
  now?: Date,
): PlanVersionRecord {
  return {
    nodeId: node.id,
    version: node.version,
    snapshot: {
      ...node,
      destinations: [...node.destinations],
      evidence: [...node.evidence],
      assumptions: [...node.assumptions],
      risks: [...node.risks],
      tradeoffs: [...node.tradeoffs],
      missingData: [...node.missingData],
      parentIds: [...node.parentIds],
      constraints: {
        hard: [...node.constraints.hard],
        soft: [...node.constraints.soft],
        flexibleDimensions: [...node.constraints.flexibleDimensions],
      },
      travelerProfile: {
        ...node.travelerProfile,
        interests: [...node.travelerProfile.interests],
        styleNotes: [...node.travelerProfile.styleNotes],
      },
      budget: { ...node.budget },
      dates: { ...node.dates },
    },
    reason,
    timestamp: isoNow(now),
  }
}

export function versionsForNode(
  versions: PlanVersionRecord[],
  nodeId: string,
): PlanVersionRecord[] {
  return versions.filter((v) => v.nodeId === nodeId).sort((a, b) => a.version - b.version)
}

export const PlanVersion = {
  record: recordPlanVersion,
  forNode: versionsForNode,
}
