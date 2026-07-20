/**
 * Sprint 43 — Rahhal AI Orchestrator types.
 * Routing / planning / ranking only — no engine business logic.
 */

import type { ConversationStructuredResponse } from '../chat/conversationExperience/types'
import type { UnifiedTravelPlanResult } from '../brain/unifiedTravel/types'
import type { EnrichedConversationMemory } from '../brain/memory/types'

/** Logical tools the orchestrator may invoke (user-facing names never expose these). */
export type OrchestratorToolId =
  | 'destination'
  | 'flights'
  | 'hotels'
  | 'visa'
  | 'insurance'
  | 'activities'
  | 'supplier_marketplace'
  | 'loyalty'
  | 'finance'
  | 'refund_policy'
  | 'disruption'
  | 'travel_documents'
  | 'timeline'
  | 'notifications'
  | 'booking'
  | 'travel_execution'
  | 'payments'
  | 'ai_conversation'

export type PlannerStage = 'plan' | 'execute' | 'observe' | 'continue'

export type OrchestratorIntent =
  | 'destination_travel'
  | 'cheapest_option'
  | 'flight_cancelled'
  | 'lost_passport'
  | 'single_tool'
  | 'general_plan'
  | 'fallback'

export type ToolParallelGroup = {
  /** Tools that may run concurrently in this wave. */
  tools: OrchestratorToolId[]
  /** When true, tools in the group run via Promise.all. */
  parallel: boolean
}

export type PlannerDecision = {
  intent: OrchestratorIntent
  stages: PlannerStage[]
  waves: ToolParallelGroup[]
  reason: string
  memoryHintsUsed: string[]
  missingSlots: string[]
}

export type RankedRecommendation = {
  id: string
  kind: 'flight' | 'hotel' | 'activity' | 'visa' | 'insurance' | 'supplier' | 'recovery' | 'other'
  title: string
  score: number
  price: number | null
  currency: string | null
  quality: number
  refundFlexibility: number
  supplierScore: number
  travelTimeHours: number | null
  loyaltyValue: number
  preferenceMatch: number
  reasons: string[]
  payload?: Record<string, unknown>
}

export type ToolExecutionResult = {
  tool: OrchestratorToolId
  ok: boolean
  durationMs: number
  summary: string
  recommendations: RankedRecommendation[]
  error?: string
  data?: Record<string, unknown>
}

export type OrchestratorObservability = {
  selectedTools: OrchestratorToolId[]
  executionTimeMs: number
  plannerDecisions: PlannerDecision
  fallbackReasons: string[]
  errors: Array<{ tool?: OrchestratorToolId; message: string }>
  parallelWaves: number
}

export type OrchestratorMemorySnapshot = {
  budget: { amount: number | null; currency: string | null }
  travellers: { adults: number | null; children: number | null }
  passport: { nationality: string | null; passportCountry: string | null }
  nationality: string | null
  preferredAirlines: string[]
  hotelPreferences: string[]
  seatPreferences: string[]
  loyaltyMemberships: string[]
  destination: string | null
  origin: string | null
  raw?: EnrichedConversationMemory | null
}

export type OrchestratorRunInput = {
  conversationId: string
  userText: string
  locale?: 'ar' | 'en'
  userId?: string
  signal?: AbortSignal
  /** Pre-assembled memory; when omitted the orchestrator loads Sprint 28 memory. */
  memory?: OrchestratorMemorySnapshot | null
  commandHint?: string | null
}

export type OrchestratorRunResult = {
  intent: OrchestratorIntent
  text: string
  structured: ConversationStructuredResponse
  planResult: UnifiedTravelPlanResult | null
  recommendations: RankedRecommendation[]
  toolResults: ToolExecutionResult[]
  observability: OrchestratorObservability
  /** Sprint 42 card-friendly meta (no internal engine names). */
  uiMeta: Record<string, unknown>
  usedFallback: boolean
}
