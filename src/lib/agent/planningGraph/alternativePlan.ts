/**
 * Evolution Sprint 4 — AlternativePlan
 * Lightweight view of a plan node as an alternative scenario.
 */

import type { PlanNodeData } from './planningGraphTypes'

export interface AlternativePlanView {
  nodeId: string
  label: string
  destinations: string[]
  score: number
  confidence: number
  whyExists: string
  status: PlanNodeData['status']
  tradeoffs: string[]
  risks: string[]
}

export function toAlternativePlan(node: PlanNodeData): AlternativePlanView {
  return {
    nodeId: node.id,
    label: node.label,
    destinations: [...node.destinations],
    score: node.score,
    confidence: node.confidence,
    whyExists: node.whyExists,
    status: node.status,
    tradeoffs: [...node.tradeoffs],
    risks: [...node.risks],
  }
}

export function listAlternatives(
  nodes: PlanNodeData[],
  excludeId?: string,
): AlternativePlanView[] {
  return nodes
    .filter((n) => n.status === 'active' || n.status === 'branched' || n.status === 'restored')
    .filter((n) => n.id !== excludeId)
    .map(toAlternativePlan)
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
}

export const AlternativePlan = {
  fromNode: toAlternativePlan,
  list: listAlternatives,
}
