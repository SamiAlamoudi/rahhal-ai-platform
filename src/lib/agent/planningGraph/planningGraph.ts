/**
 * Evolution Sprint 4 — PlanningGraph
 *
 * Multi-plan DAG: branch / merge / compare / reject / restore / clone / score.
 * Keeps rejected plans. CPU-only. Not wired into planTurn.
 */

import { isPlanningGraphEnabled } from './planningGraphFeature'
import { createPlanNode, clonePlanNodeData, scorePlanNode } from './planNode'
import {
  createScenarioBranch,
  appendNodeToBranch,
  setBranchStatus,
} from './scenarioBranch'
import { recordPlanVersion } from './planVersion'
import { createDecisionFork } from './decisionFork'
import { propagateConstraints } from './constraintPropagation'
import { propagatePreferences, propagateConfidence } from './preferencePropagation'
import { comparePlans } from './planComparison'
import { findMergeCandidates } from './mergeCandidates'
import { findDiscardCandidates } from './discardCandidates'
import { selectBestPlan } from './bestPlanSelector'
import { listAlternatives } from './alternativePlan'
import {
  isoNow,
  newId,
  clamp01,
  clampScore,
  type CreatePlanInput,
  type GraphEdge,
  type PlanComparisonResult,
  type PlanNodeData,
  type PlanningGraphState,
  type PlanningLocale,
  type BestPlanSelection,
  type MergeCandidate,
  type DiscardCandidate,
} from './planningGraphTypes'

function logDecision(
  graph: PlanningGraphState,
  action: string,
  detail: string,
  nodeIds: string[],
  now?: Date,
): void {
  graph.decisionLog.push({
    timestamp: isoNow(now),
    action,
    detail,
    nodeIds,
  })
  graph.updatedAt = isoNow(now)
}

function addEdge(
  graph: PlanningGraphState,
  kind: GraphEdge['kind'],
  fromId: string,
  toId: string,
  reason: string,
  now?: Date,
): void {
  graph.edges.push({
    id: newId('edge', now),
    kind,
    fromId,
    toId,
    reason,
    timestamp: isoNow(now),
  })
}

export function createPlanningGraph(
  locale: PlanningLocale = 'ar',
  now?: Date,
): PlanningGraphState {
  const stamp = isoNow(now)
  return {
    id: newId('pgraph', now),
    locale,
    createdAt: stamp,
    updatedAt: stamp,
    nodes: {},
    edges: [],
    branches: {},
    versions: [],
    forks: [],
    rejectedNodeIds: [],
    activeBranchId: null,
    decisionLog: [],
  }
}

export function addRootPlan(
  graph: PlanningGraphState,
  input: CreatePlanInput,
): PlanNodeData {
  const now = input.now
  const locale = input.locale ?? graph.locale
  // Temporary branch id filled after node create — create branch first with placeholder.
  const branchId = newId('branch', now)
  const node = createPlanNode(
    { ...input, locale, whyExists: input.whyExists ?? 'Root planning scenario.' },
    { branchId, parentIds: [], version: 1, status: 'active' },
  )
  const branch = createScenarioBranch({
    name: input.branchName ?? node.label,
    rootNodeId: node.id,
    whyExists: node.whyExists,
    locale,
    now,
  })
  // Align ids: recreate branch with real id already assigned — use branch.id on node.
  node.branchId = branch.id
  graph.nodes[node.id] = node
  graph.branches[branch.id] = branch
  graph.activeBranchId = branch.id
  graph.versions.push(recordPlanVersion(node, 'Root plan created', now))
  logDecision(graph, 'create', `Root plan ${node.id}`, [node.id], now)
  return node
}

export function branchPlan(
  graph: PlanningGraphState,
  fromNodeId: string,
  input: CreatePlanInput & { reason: string },
): PlanNodeData {
  const parent = graph.nodes[fromNodeId]
  if (!parent) throw new Error(`Unknown plan node: ${fromNodeId}`)
  const now = input.now
  const locale = input.locale ?? parent.locale

  let child = createPlanNode(
    {
      ...input,
      locale,
      intent: input.intent ?? parent.intent,
      travelerProfile: { ...parent.travelerProfile, ...(input.travelerProfile ?? {}) },
      constraints: input.constraints ?? parent.constraints,
      budget: { ...parent.budget, ...(input.budget ?? {}) },
      dates: { ...parent.dates, ...(input.dates ?? {}) },
      destinations: input.destinations ?? [...parent.destinations],
      confidence: input.confidence ?? parent.confidence,
      score: input.score ?? parent.score,
      reasoningRef: input.reasoningRef ?? parent.reasoningRef,
      reflectionRef: input.reflectionRef ?? parent.reflectionRef,
      evidence: [...parent.evidence, ...(input.evidence ?? [])],
      assumptions: [...parent.assumptions, ...(input.assumptions ?? [])],
      risks: [...parent.risks, ...(input.risks ?? [])],
      tradeoffs: [...parent.tradeoffs, ...(input.tradeoffs ?? [])],
      missingData: input.missingData ?? [...parent.missingData],
      whyExists: input.whyExists ?? input.reason,
      label: input.label ?? `${parent.label} · branch`,
    },
    { branchId: 'pending', parentIds: [parent.id], version: 1, status: 'active' },
  )

  child = propagateConstraints(parent, child)
  child = propagatePreferences(parent, child)
  child.confidence = clamp01(propagateConfidence(parent, child))
  child.score = clampScore(scorePlanNode(child))

  const branch = createScenarioBranch({
    name: input.branchName ?? child.label,
    rootNodeId: child.id,
    whyExists: input.reason,
    locale,
    now,
  })
  child.branchId = branch.id

  parent.status = parent.status === 'rejected' ? parent.status : 'branched'
  parent.updatedAt = isoNow(now)

  graph.nodes[child.id] = child
  graph.nodes[parent.id] = parent
  graph.branches[branch.id] = branch
  graph.activeBranchId = branch.id
  addEdge(graph, 'branch', parent.id, child.id, input.reason, now)
  const fork = createDecisionFork({
    fromNodeId: parent.id,
    toNodeIds: [child.id],
    reason: input.reason,
    evidence: input.evidence,
    now,
  })
  graph.forks.push(fork)
  graph.versions.push(recordPlanVersion(child, `Branched from ${parent.id}`, now))
  logDecision(graph, 'branch', input.reason, [parent.id, child.id], now)
  return child
}

export function clonePlan(
  graph: PlanningGraphState,
  nodeId: string,
  options?: { label?: string; whyExists?: string; now?: Date },
): PlanNodeData {
  const source = graph.nodes[nodeId]
  if (!source) throw new Error(`Unknown plan node: ${nodeId}`)
  const now = options?.now
  const branch = createScenarioBranch({
    name: options?.label ?? `${source.label} · clone`,
    rootNodeId: 'pending',
    whyExists: options?.whyExists ?? `Clone of ${source.id}`,
    locale: source.locale,
    now,
  })
  const cloned = clonePlanNodeData(source, {
    now,
    label: options?.label ?? `${source.label} · clone`,
    whyExists: options?.whyExists ?? `Clone of ${source.id}`,
    status: 'active',
    branchId: branch.id,
    parentIds: [source.id],
    version: 1,
  })
  branch.rootNodeId = cloned.id
  branch.tipNodeId = cloned.id
  branch.nodeIds = [cloned.id]
  graph.nodes[cloned.id] = cloned
  graph.branches[branch.id] = branch
  addEdge(graph, 'clone', source.id, cloned.id, cloned.whyExists, now)
  graph.versions.push(recordPlanVersion(cloned, `Cloned from ${source.id}`, now))
  logDecision(graph, 'clone', cloned.whyExists, [source.id, cloned.id], now)
  return cloned
}

export function mergePlans(
  graph: PlanningGraphState,
  leftId: string,
  rightId: string,
  options?: { reason?: string; now?: Date; label?: string },
): PlanNodeData {
  const left = graph.nodes[leftId]
  const right = graph.nodes[rightId]
  if (!left || !right) throw new Error('Merge requires two known plan nodes')
  const now = options?.now
  const reason = options?.reason ?? `Merge ${left.label} + ${right.label}`

  const destinations = [...new Set([...left.destinations, ...right.destinations])]
  const confidence = clamp01((left.confidence + right.confidence) / 2 + 0.05)
  let merged = createPlanNode(
    {
      locale: left.locale,
      label: options?.label ?? `${left.label} ⊕ ${right.label}`,
      intent: left.intent,
      travelerProfile: {
        purpose: left.travelerProfile.purpose ?? right.travelerProfile.purpose,
        pace: left.travelerProfile.pace ?? right.travelerProfile.pace,
        budgetStance: left.travelerProfile.budgetStance ?? right.travelerProfile.budgetStance,
        riskTolerance: left.travelerProfile.riskTolerance ?? right.travelerProfile.riskTolerance,
        partySize: left.travelerProfile.partySize ?? right.travelerProfile.partySize,
        interests: [...new Set([...left.travelerProfile.interests, ...right.travelerProfile.interests])],
        styleNotes: [...new Set([...left.travelerProfile.styleNotes, ...right.travelerProfile.styleNotes])],
      },
      constraints: {
        hard: [...new Set([...left.constraints.hard, ...right.constraints.hard])],
        soft: [...new Set([...left.constraints.soft, ...right.constraints.soft])],
        flexibleDimensions: [
          ...new Set([
            ...left.constraints.flexibleDimensions,
            ...right.constraints.flexibleDimensions,
          ]),
        ],
      },
      budget: {
        amount: left.budget.amount ?? right.budget.amount,
        currency: left.budget.currency ?? right.budget.currency,
        stance: left.budget.stance ?? right.budget.stance,
      },
      dates: {
        startDate: left.dates.startDate ?? right.dates.startDate,
        endDate: left.dates.endDate ?? right.dates.endDate,
        durationDays: left.dates.durationDays ?? right.dates.durationDays,
        monthHint: left.dates.monthHint ?? right.dates.monthHint,
        flexible: left.dates.flexible || right.dates.flexible,
      },
      destinations,
      confidence,
      score: clampScore((left.score + right.score) / 2 + 5),
      reasoningRef: left.reasoningRef ?? right.reasoningRef,
      reflectionRef: left.reflectionRef ?? right.reflectionRef,
      evidence: [...new Set([...left.evidence, ...right.evidence])],
      assumptions: [...new Set([...left.assumptions, ...right.assumptions])],
      risks: [...new Set([...left.risks, ...right.risks])],
      tradeoffs: [...new Set([...left.tradeoffs, ...right.tradeoffs, 'Merged scenario may dilute focus.'])],
      missingData: [...new Set([...left.missingData, ...right.missingData])].filter(
        (m) => !(m.includes('destination') && destinations.length),
      ),
      whyExists: reason,
      now,
    },
    { branchId: 'pending', parentIds: [left.id, right.id], version: 1, status: 'active' },
  )

  merged = propagateConstraints(left, merged)
  merged = propagatePreferences(right, merged)
  merged.score = clampScore(scorePlanNode(merged))

  const branch = createScenarioBranch({
    name: merged.label,
    rootNodeId: merged.id,
    whyExists: reason,
    locale: merged.locale,
    now,
  })
  merged.branchId = branch.id

  left.status = 'merged'
  right.status = 'merged'
  left.updatedAt = isoNow(now)
  right.updatedAt = isoNow(now)

  const leftBranch = graph.branches[left.branchId]
  const rightBranch = graph.branches[right.branchId]
  if (leftBranch) graph.branches[left.branchId] = setBranchStatus(leftBranch, 'merged', now)
  if (rightBranch) graph.branches[right.branchId] = setBranchStatus(rightBranch, 'merged', now)

  graph.nodes[merged.id] = merged
  graph.nodes[left.id] = left
  graph.nodes[right.id] = right
  graph.branches[branch.id] = branch
  graph.activeBranchId = branch.id
  addEdge(graph, 'merge', left.id, merged.id, reason, now)
  addEdge(graph, 'merge', right.id, merged.id, reason, now)
  graph.versions.push(recordPlanVersion(merged, reason, now))
  logDecision(graph, 'merge', reason, [left.id, right.id, merged.id], now)
  return merged
}

export function rejectPlan(
  graph: PlanningGraphState,
  nodeId: string,
  options?: { reason?: string; now?: Date },
): PlanNodeData {
  const node = graph.nodes[nodeId]
  if (!node) throw new Error(`Unknown plan node: ${nodeId}`)
  const now = options?.now
  const reason = options?.reason ?? 'Rejected by consultant / traveler choice.'
  node.status = 'rejected'
  node.updatedAt = isoNow(now)
  node.whyExists = `${node.whyExists} | rejected: ${reason}`
  if (!graph.rejectedNodeIds.includes(nodeId)) graph.rejectedNodeIds.push(nodeId)
  const branch = graph.branches[node.branchId]
  if (branch) graph.branches[node.branchId] = setBranchStatus(branch, 'rejected', now)
  addEdge(graph, 'reject', nodeId, nodeId, reason, now)
  graph.versions.push(recordPlanVersion(node, reason, now))
  logDecision(graph, 'reject', reason, [nodeId], now)
  return node
}

export function restorePlan(
  graph: PlanningGraphState,
  nodeId: string,
  options?: { reason?: string; now?: Date },
): PlanNodeData {
  const source = graph.nodes[nodeId]
  if (!source) throw new Error(`Unknown plan node: ${nodeId}`)
  const now = options?.now
  const reason = options?.reason ?? `Restored previous idea ${nodeId}`

  const restored = clonePlanNodeData(source, {
    now,
    status: 'restored',
    whyExists: reason,
    label: source.label,
    parentIds: [source.id],
    version: source.version + 1,
    branchId: source.branchId,
  })
  // New open branch tip for the restored idea
  const branch = createScenarioBranch({
    name: `${source.label} · restored`,
    rootNodeId: restored.id,
    whyExists: reason,
    locale: source.locale,
    now,
  })
  restored.branchId = branch.id
  restored.status = 'active'

  graph.nodes[restored.id] = restored
  graph.branches[branch.id] = branch
  graph.activeBranchId = branch.id
  graph.rejectedNodeIds = graph.rejectedNodeIds.filter((id) => id !== nodeId)
  addEdge(graph, 'restore', source.id, restored.id, reason, now)
  graph.versions.push(recordPlanVersion(restored, reason, now))
  logDecision(graph, 'restore', reason, [source.id, restored.id], now)
  return restored
}

export function scorePlan(graph: PlanningGraphState, nodeId: string): number {
  const node = graph.nodes[nodeId]
  if (!node) throw new Error(`Unknown plan node: ${nodeId}`)
  const score = scorePlanNode(node)
  node.score = score
  node.updatedAt = isoNow()
  return score
}

export function compareGraphPlans(
  graph: PlanningGraphState,
  leftId: string,
  rightId: string,
): PlanComparisonResult {
  const left = graph.nodes[leftId]
  const right = graph.nodes[rightId]
  if (!left || !right) throw new Error('Compare requires two known plan nodes')
  const result = comparePlans(left, right)
  logDecision(graph, 'compare', `Compared ${leftId} vs ${rightId}`, [leftId, rightId])
  return result
}

export function listGraphNodes(graph: PlanningGraphState): PlanNodeData[] {
  return Object.values(graph.nodes)
}

export function getRejectedPlans(graph: PlanningGraphState): PlanNodeData[] {
  return graph.rejectedNodeIds.map((id) => graph.nodes[id]).filter(Boolean) as PlanNodeData[]
}

export function selectBest(graph: PlanningGraphState): BestPlanSelection {
  return selectBestPlan(listGraphNodes(graph))
}

export function mergeCandidateList(graph: PlanningGraphState): MergeCandidate[] {
  return findMergeCandidates(listGraphNodes(graph))
}

export function discardCandidateList(graph: PlanningGraphState): DiscardCandidate[] {
  return findDiscardCandidates(listGraphNodes(graph))
}

export function alternativeList(graph: PlanningGraphState, excludeId?: string) {
  return listAlternatives(listGraphNodes(graph), excludeId)
}

/** Gate-aware helpers — return null when flag OFF unless forced. */
export function tryCreatePlanningGraph(
  locale?: PlanningLocale,
  options?: { enabled?: boolean; now?: Date },
): PlanningGraphState | null {
  if (!isPlanningGraphEnabled(options)) return null
  return createPlanningGraph(locale, options?.now)
}

export const PlanningGraph = {
  create: createPlanningGraph,
  tryCreate: tryCreatePlanningGraph,
  addRoot: addRootPlan,
  branch: branchPlan,
  merge: mergePlans,
  compare: compareGraphPlans,
  reject: rejectPlan,
  restore: restorePlan,
  clone: clonePlan,
  score: scorePlan,
  selectBest,
  mergeCandidates: mergeCandidateList,
  discardCandidates: discardCandidateList,
  alternatives: alternativeList,
  nodes: listGraphNodes,
  rejected: getRejectedPlans,
  appendToBranch: (graph: PlanningGraphState, branchId: string, nodeId: string, now?: Date) => {
    const branch = graph.branches[branchId]
    if (!branch) throw new Error(`Unknown branch: ${branchId}`)
    graph.branches[branchId] = appendNodeToBranch(branch, nodeId, now)
  },
}
