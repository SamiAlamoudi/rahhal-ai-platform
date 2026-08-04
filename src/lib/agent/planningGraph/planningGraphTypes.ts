/**
 * Evolution Sprint 4 — Planning Graph Layer contracts.
 *
 * Additive only. Does not modify Reasoning, Reflection, Decision Engine,
 * Planning Draft, Conversation Brain, Smart Clarification, Production Authority,
 * or planTurn. CPU-only — no network / LLM.
 */

export type PlanningLocale = 'ar' | 'en'

export type PlanNodeStatus =
  | 'active'
  | 'branched'
  | 'merged'
  | 'rejected'
  | 'archived'
  | 'restored'

export type GraphEdgeKind =
  | 'branch'
  | 'merge'
  | 'clone'
  | 'restore'
  | 'reject'
  | 'supersede'

export interface PlanBudgetSnapshot {
  amount: number | null
  currency: string | null
  stance: string | null
}

export interface PlanDatesSnapshot {
  startDate: string | null
  endDate: string | null
  durationDays: number | null
  monthHint: number | null
  flexible: boolean
}

export interface PlanTravelerProfileSnapshot {
  purpose: string | null
  pace: string | null
  budgetStance: string | null
  riskTolerance: string | null
  partySize: number | null
  interests: string[]
  styleNotes: string[]
}

/**
 * Plan Node — unit of multi-plan memory.
 * Required fields per Sprint 4 mission.
 */
export interface PlanNodeData {
  id: string
  label: string
  status: PlanNodeStatus
  locale: PlanningLocale
  /** Intent label (discover / plan / compare / …). */
  intent: string
  travelerProfile: PlanTravelerProfileSnapshot
  constraints: {
    hard: string[]
    soft: string[]
    flexibleDimensions: string[]
  }
  budget: PlanBudgetSnapshot
  dates: PlanDatesSnapshot
  destinations: string[]
  confidence: number
  score: number
  /** Opaque reference to Sprint 1 reasoning pipeline result / session. */
  reasoningRef: string | null
  /** Opaque reference to Sprint 2 reflection session / recommendation. */
  reflectionRef: string | null
  evidence: string[]
  assumptions: string[]
  risks: string[]
  tradeoffs: string[]
  missingData: string[]
  /** Why this node/branch exists. */
  whyExists: string
  parentIds: string[]
  branchId: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface PlanVersionRecord {
  nodeId: string
  version: number
  snapshot: PlanNodeData
  reason: string
  timestamp: string
}

export interface ScenarioBranchRecord {
  id: string
  name: string
  rootNodeId: string
  tipNodeId: string
  whyExists: string
  status: 'open' | 'merged' | 'rejected' | 'archived'
  locale: PlanningLocale
  createdAt: string
  updatedAt: string
  nodeIds: string[]
}

export interface DecisionForkRecord {
  id: string
  fromNodeId: string
  toNodeIds: string[]
  reason: string
  evidence: string[]
  timestamp: string
}

export interface GraphEdge {
  id: string
  kind: GraphEdgeKind
  fromId: string
  toId: string
  reason: string
  timestamp: string
}

export interface PlanComparisonResult {
  leftId: string
  rightId: string
  winnerId: string | null
  scoreDelta: number
  confidenceDelta: number
  reasons: string[]
  tradeoffs: string[]
  risks: string[]
}

export interface MergeCandidate {
  leftId: string
  rightId: string
  compatibility: number
  reasons: string[]
  conflicts: string[]
}

export interface DiscardCandidate {
  nodeId: string
  reason: string
  score: number
  confidence: number
}

export interface BestPlanSelection {
  nodeId: string | null
  score: number
  confidence: number
  reasons: string[]
  runnersUp: Array<{ nodeId: string; score: number }>
}

export interface PlanningGraphState {
  id: string
  locale: PlanningLocale
  createdAt: string
  updatedAt: string
  nodes: Record<string, PlanNodeData>
  edges: GraphEdge[]
  branches: Record<string, ScenarioBranchRecord>
  versions: PlanVersionRecord[]
  forks: DecisionForkRecord[]
  rejectedNodeIds: string[]
  activeBranchId: string | null
  decisionLog: Array<{
    timestamp: string
    action: string
    detail: string
    nodeIds: string[]
  }>
}

export interface CreatePlanInput {
  label?: string
  locale?: PlanningLocale
  intent?: string
  travelerProfile?: Partial<PlanTravelerProfileSnapshot>
  constraints?: Partial<PlanNodeData['constraints']>
  budget?: Partial<PlanBudgetSnapshot>
  dates?: Partial<PlanDatesSnapshot>
  destinations?: string[]
  confidence?: number
  score?: number
  reasoningRef?: string | null
  reflectionRef?: string | null
  evidence?: string[]
  assumptions?: string[]
  risks?: string[]
  tradeoffs?: string[]
  missingData?: string[]
  whyExists?: string
  branchName?: string
  now?: Date
}

export function isoNow(now?: Date): string {
  return (now ?? new Date()).toISOString()
}

export function newId(prefix: string, now?: Date): string {
  const t = (now ?? new Date()).getTime().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${t}_${r}`
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

export function emptyProfile(): PlanTravelerProfileSnapshot {
  return {
    purpose: null,
    pace: null,
    budgetStance: null,
    riskTolerance: null,
    partySize: null,
    interests: [],
    styleNotes: [],
  }
}

export function emptyConstraints(): PlanNodeData['constraints'] {
  return { hard: [], soft: [], flexibleDimensions: [] }
}

export function emptyBudget(): PlanBudgetSnapshot {
  return { amount: null, currency: null, stance: null }
}

export function emptyDates(): PlanDatesSnapshot {
  return {
    startDate: null,
    endDate: null,
    durationDays: null,
    monthHint: null,
    flexible: false,
  }
}
