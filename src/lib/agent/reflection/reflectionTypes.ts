/**
 * Evolution Sprint 2 — Consultant Reflection Layer contracts.
 *
 * Additive only. Imports Sprint 1 reasoning; does not modify those modules.
 * Does not touch Decision Engine, Planning Draft, Conversation Brain,
 * Smart Clarification, Production Authority, or planTurn.
 * No network / API / LLM calls.
 */

import type {
  BudgetReasonerResult,
  ConsultantLocale,
  ConsultantReasoningInput,
  ConsultantReasoningPipelineResult,
  ConstraintAnalyzerResult,
  DestinationReasonerResult,
  ExplanationResult,
  RecommendationReasonerResult,
  RiskReasonerResult,
  TravelerIntentResult,
  TravelerProfileResult,
  ValueReasonerResult,
} from '../reasoning/consultantTypes'

/** Reasoning graph nodes that can be invalidated independently. */
export type ReasoningNodeId =
  | 'intent'
  | 'profile'
  | 'constraints'
  | 'destination'
  | 'budget'
  | 'risk'
  | 'value'
  | 'recommendation'
  | 'explanation'

export type ReflectionSlotKey =
  | 'destination'
  | 'origin'
  | 'budgetAmount'
  | 'budgetCurrency'
  | 'durationDays'
  | 'adults'
  | 'children'
  | 'monthHint'
  | 'interests'
  | 'tripPurpose'

export interface KnownSlots {
  destination?: string | null
  origin?: string | null
  budgetAmount?: number | null
  budgetCurrency?: string | null
  durationDays?: number | null
  adults?: number | null
  children?: number | null
  monthHint?: number | null
  interests?: string[]
  tripPurpose?: string | null
}

export interface ConversationTurn {
  id: string
  role: 'user' | 'consultant'
  text: string
  locale: ConsultantLocale
  timestamp: string
  /** Slots extracted or confirmed on this turn (delta only). */
  slotDelta: Partial<KnownSlots>
  /** Evidence strings supporting the delta. */
  evidence: string[]
}

export interface TravelerStateSnapshot {
  locale: ConsultantLocale
  slots: KnownSlots
  priorities: string[]
  turnCount: number
  updatedAt: string
}

/** Per-dimension confidence over time. */
export interface ConfidencePoint {
  timestamp: string
  overall: number
  byNode: Partial<Record<ReasoningNodeId, number>>
  reason: string
}

export interface ClarificationItem {
  field: string
  priority: number
  reason: string
  blocking: boolean
}

export interface AssumptionRecord {
  id: string
  text: string
  node: ReasoningNodeId
  status: 'active' | 'confirmed' | 'invalidated'
  createdAt: string
  updatedAt: string
  evidence: string[]
}

/**
 * Every stored recommendation revision.
 * Required fields per Sprint 2 mission.
 */
export interface RecommendationRecord {
  id: string
  confidence: number
  timestamp: string
  evidence: string[]
  constraints: string[]
  tradeoffs: string[]
  assumptions: string[]
  missingData: string[]
  reasonForChange: string
  /** Snapshot of primary action / why package. */
  primaryAction: RecommendationReasonerResult['recommendation']['primaryAction']
  why: string[]
  whyNot: string[]
  alternative: string[]
  risk: string[]
  expectedValue: string[]
  recommendationScore: number
  /** Nodes recomputed for this revision. */
  refreshedNodes: ReasoningNodeId[]
}

export interface DecisionHistoryEntry {
  recordId: string
  timestamp: string
  reasonForChange: string
  confidenceBefore: number | null
  confidenceAfter: number
  refreshedNodes: ReasoningNodeId[]
}

export interface CachedReasoningNodes {
  intent: TravelerIntentResult | null
  profile: TravelerProfileResult | null
  constraints: ConstraintAnalyzerResult | null
  destination: DestinationReasonerResult | null
  budget: BudgetReasonerResult | null
  risk: RiskReasonerResult | null
  value: ValueReasonerResult | null
  recommendation: RecommendationReasonerResult | null
  explanation: ExplanationResult | null
}

export interface ReflectionSession {
  id: string
  createdAt: string
  updatedAt: string
  locale: ConsultantLocale
  turns: ConversationTurn[]
  state: TravelerStateSnapshot
  nodes: CachedReasoningNodes
  confidenceHistory: ConfidencePoint[]
  assumptions: AssumptionRecord[]
  recommendations: RecommendationRecord[]
  decisionHistory: DecisionHistoryEntry[]
  clarificationQueue: ClarificationItem[]
  alternatives: string[]
  lastExplanation: ExplanationResult | null
}

export interface ReflectionTurnInput {
  userText: string
  locale?: ConsultantLocale
  /** Explicit slot overrides from caller (optional). */
  knownDelta?: Partial<KnownSlots>
  /** Wall clock override for tests. */
  now?: Date
  /** Force-enable regardless of feature flag. */
  enabled?: boolean
}

export interface ReflectionPipelineResult {
  session: ReflectionSession
  /** Nodes that were recomputed this turn. */
  refreshedNodes: ReasoningNodeId[]
  /** Nodes reused from cache. */
  reusedNodes: ReasoningNodeId[]
  latestRecommendation: RecommendationRecord | null
  clarificationQueue: ClarificationItem[]
  explanationRevision: {
    locale: ConsultantLocale
    headline: string
    body: string[]
    changeNote: string | null
    nextStep: string | null
  }
  /** Full Sprint 1-shaped bundle when all nodes present (for consumers). */
  reasoningBundle: ConsultantReasoningPipelineResult | null
}

export function emptyNodes(): CachedReasoningNodes {
  return {
    intent: null,
    profile: null,
    constraints: null,
    destination: null,
    budget: null,
    risk: null,
    value: null,
    recommendation: null,
    explanation: null,
  }
}

export function emptySlots(): KnownSlots {
  return {}
}

export function toReasoningInput(
  text: string,
  slots: KnownSlots,
  locale: ConsultantLocale,
): ConsultantReasoningInput {
  return {
    locale,
    userText: text,
    known: { ...slots },
  }
}

export function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

export function isoNow(now?: Date): string {
  return (now ?? new Date()).toISOString()
}

export function newId(prefix: string, now?: Date): string {
  const t = (now ?? new Date()).getTime().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${t}_${r}`
}
