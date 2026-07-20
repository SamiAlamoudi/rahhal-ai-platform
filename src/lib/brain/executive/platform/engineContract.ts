/**
 * Sprint 51 — Executive Engine contract.
 * Every engine exposes analyze → plan → execute + confidence + metadata.
 */

import type { PersonalizationProfile } from '../../../ai/preferences/types'
import type { AgentMemory } from '../../../agent/types'
import type { TravelReasoningResult } from '../../../agent/reasoning/types'
import type {
  BrainIntentResult,
  ConversationUnderstanding,
} from '../../core/types'
import type { ExecutiveContext } from '../types'

export type ExecutivePriority = 'critical' | 'high' | 'medium' | 'low'

export type ExecutiveEngineId =
  | 'trip_monitor'
  | 'live_concierge'
  | 'explainable_decision'
  | 'travel_memory'
  | 'multimodal_document'
  | 'budget_intelligence_v2'
  | 'itinerary_optimizer'
  | 'risk'
  | 'executive_response'
  | 'learning'

export interface DocumentInput {
  kind: 'passport' | 'visa' | 'boarding_pass' | 'hotel_voucher' | 'flight_confirmation' | 'pdf' | 'image' | 'screenshot' | 'unknown'
  text: string
  filename?: string
}

export interface TripMonitorSignals {
  flightDelayMinutes?: number | null
  gateChange?: string | null
  weatherAlert?: string | null
  visaExpiringDays?: number | null
  passportExpiringDays?: number | null
  advisoryLevel?: 'none' | 'watch' | 'warning' | 'critical'
  hotelIssue?: string | null
  strikeAlert?: string | null
}

export interface ExecutiveEngineContext {
  userId: string
  userText: string
  locale: AgentMemory['locale']
  memory: AgentMemory
  understanding: ConversationUnderstanding
  intents: BrainIntentResult
  reasoningResult: TravelReasoningResult | null
  profile: PersonalizationProfile
  executiveContext: ExecutiveContext | null
  now: Date
  tripSignals?: TripMonitorSignals
  documents?: DocumentInput[]
}

export interface ExecutiveAnalysis {
  engineId: ExecutiveEngineId
  findings: string[]
  signals: Record<string, unknown>
  priority: ExecutivePriority
}

export interface ExecutivePlanAction {
  id: string
  description: string
  priority: ExecutivePriority
}

export interface ExecutivePlan {
  engineId: ExecutiveEngineId
  actions: ExecutivePlanAction[]
  alternatives: string[]
}

export interface ExecutiveAlert {
  priority: ExecutivePriority
  message: string
  category: string
}

export interface ExecutiveRecommendation {
  title: string
  why: string[]
  whyNot?: string[]
  pros: string[]
  cons: string[]
  tradeoffs: string[]
  confidence: number
  budgetImpact?: string | null
  visaImpact?: string | null
  weatherImpact?: string | null
}

export interface ExecutiveExecution {
  engineId: ExecutiveEngineId
  applied: boolean
  effects: string[]
  replyFragment: string | null
  alerts: ExecutiveAlert[]
  recommendations: ExecutiveRecommendation[]
  memoryNotes: string[]
  nextBestAction: string | null
  metadata: Record<string, unknown>
}

export interface ExecutiveEngineMetadata {
  engineId: ExecutiveEngineId
  version: string
  name: string
  description: string
}

export interface ExecutiveEngine {
  metadata(): ExecutiveEngineMetadata
  analyze(ctx: ExecutiveEngineContext): ExecutiveAnalysis
  plan(ctx: ExecutiveEngineContext, analysis: ExecutiveAnalysis): ExecutivePlan
  execute(ctx: ExecutiveEngineContext, plan: ExecutivePlan): ExecutiveExecution
  confidence(ctx: ExecutiveEngineContext, analysis: ExecutiveAnalysis): number
}

export interface EngineRunResult {
  engineId: ExecutiveEngineId
  analysis: ExecutiveAnalysis
  plan: ExecutivePlan
  execution: ExecutiveExecution
  confidence: number
  metadata: ExecutiveEngineMetadata
}

export interface ExecutivePlatformResult {
  runs: EngineRunResult[]
  primaryReply: string | null
  alerts: ExecutiveAlert[]
  recommendations: ExecutiveRecommendation[]
  nextBestAction: string | null
  confidence: number
  engineIds: ExecutiveEngineId[]
}
