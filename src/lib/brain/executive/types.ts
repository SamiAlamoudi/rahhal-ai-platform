/**
 * Phase 2 — AI Travel Executive types.
 * Orchestrated exclusively through RahhalBrain.
 */

import type { PersonalizationProfile } from '../../ai/preferences/types'
import type { AgentMemory } from '../../agent/types'
import type { TravelReasoningResult } from '../../agent/reasoning/types'
import type {
  BrainIntentResult,
  ConversationUnderstanding,
} from '../core/types'

export type OptimizationAxis = 'scenery' | 'activities' | 'cost' | 'balanced'

export type ExecutiveTravelStyle =
  | 'luxury'
  | 'adventure'
  | 'family'
  | 'business'
  | 'romantic'
  | 'budget_sensitive'
  | 'vip'
  | 'solo'
  | 'repeat'
  | 'general'

export interface ExecutiveContext {
  locale: AgentMemory['locale']
  travelStyle: ExecutiveTravelStyle
  budgetSensitivity: 'strict' | 'flexible' | 'open'
  rejectedDestinations: string[]
  favoriteDestinations: string[]
  optimizationAxis: OptimizationAxis | null
  urgency: boolean
  luxuryPreference: boolean
  familyTravel: boolean
  businessTravel: boolean
  discoveryMode: boolean
  climateHint: string | null
  budgetSar: number | null
  budgetCurrency: string
  travelMonth: string | null
}

export interface ExecutiveEnhancement {
  context: ExecutiveContext
  reasoningResult: TravelReasoningResult | null
  optimizationAxis: OptimizationAxis | null
  learnedRejections: string[]
  budgetWarnings: string[]
}

export interface ExecutiveProcessInput {
  userText: string
  memory: AgentMemory
  understanding: ConversationUnderstanding
  intents: BrainIntentResult
  reasoningResult: TravelReasoningResult | null
  userId: string
  profile: PersonalizationProfile
}
