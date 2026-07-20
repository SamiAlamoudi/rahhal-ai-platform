/**
 * Rahhal Brain Core v1 — orchestration types (decision layer only).
 * Execution stays in existing agent / reasoning / clarification modules.
 */

import type { ExtractionResult } from '../../agent/extractRequirements'
import type { AgentMemory, AgentProviderMeta } from '../../agent/types'
import type { TravelReasoningResult } from '../../agent/reasoning/types'
import type { ExecutiveEnhancement } from '../executive/types'
import type { ExecutivePlatformResult } from '../executive/platform'

export type BrainModuleId =
  | 'memory'
  | 'preferences'
  | 'destination_discovery'
  | 'climate'
  | 'reasoning'
  | 'clarification'
  | 'budget'
  | 'visa'
  | 'safety'
  | 'advisory'
  | 'ranking'
  | 'executive'
  | 'executive_platform'
  | 'flights'
  | 'hotels'
  | 'planning'

export type RahhalBrainIntentId =
  | 'trip_planning'
  | 'destination_discovery'
  | 'budget_optimization'
  | 'visa_inquiry'
  | 'hotel_search'
  | 'flight_search'
  | 'luxury_travel'
  | 'family_travel'
  | 'business_travel'
  | 'weekend_escape'
  | 'medical_travel'
  | 'religious_travel'
  | 'adventure'
  | 'honeymoon'
  | 'general_conversation'

export type EmotionalTone = 'neutral' | 'stressed' | 'excited' | 'uncertain'

export interface ConversationUnderstanding {
  explicitRequest: string
  implicitRequests: string[]
  hiddenIntents: string[]
  travelContext: {
    hasDestination: boolean
    discoveryMode: boolean
    climateHint: string | null
    budgetMentioned: boolean
    timeframeMentioned: boolean
    partyMentioned: boolean
  }
  emotionalContext: {
    tone: EmotionalTone
    needsBreak: boolean
    isVague: boolean
  }
  constraints: string[]
}

export interface BrainIntent {
  id: RahhalBrainIntentId
  confidence: number
  signals: string[]
}

export interface BrainIntentResult {
  primary: BrainIntent
  secondary: BrainIntent[]
}

export interface InternalPlanStep {
  id: string
  goal: string
  module: BrainModuleId
  satisfied: boolean
}

export interface InternalPlan {
  steps: InternalPlanStep[]
  modulesToRun: BrainModuleId[]
}

export interface ComposedResponse {
  reasoning: string[]
  recommendation: string | null
  tradeoffs: string[]
  warnings: string[]
  nextStep: string
  body: string
}

export type RahhalBrainDecisionType = 'respond' | 'clarify' | 'continue'

export interface RahhalBrainDecision {
  type: RahhalBrainDecisionType
  reply?: string
  reflected: boolean
}

export interface RahhalBrainMetaSnapshot {
  understanding: ConversationUnderstanding
  intents: BrainIntentResult
  internalPlan: InternalPlan
  decision: RahhalBrainDecisionType
  modulesExecuted: BrainModuleId[]
  reflected: boolean
}

export interface RahhalBrainTurnInput {
  conversationId: string
  userText: string
  memory: AgentMemory
  messages: Array<{ role: string; content: string; providerMeta?: unknown }>
  userId: string
}

export interface RahhalBrainTurnResult {
  memory: AgentMemory
  extracted: ExtractionResult
  understanding: ConversationUnderstanding
  intents: BrainIntentResult
  internalPlan: InternalPlan
  reasoningResult: TravelReasoningResult | null
  reasoningMeta?: AgentProviderMeta['reasoning']
  clarificationMeta?: AgentProviderMeta['clarification']
  executive?: ExecutiveEnhancement
  executivePlatform?: ExecutivePlatformResult
  decision: RahhalBrainDecision
  meta: RahhalBrainMetaSnapshot
}
