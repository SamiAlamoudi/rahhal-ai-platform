/**
 * Sprint 91 — agent bridge for Production Alpha Experience.
 * Extracts intent / requirements, then runs ConversationOrchestrator.
 */

import {
  runAlphaExperience as runCoreAlphaExperience,
  SPRINT91_ALPHA_EXPERIENCE_VERSION,
  type AlphaOrchestrationResult,
  type AlphaOrchestrationRequirements,
  type ProviderRegistry,
} from '../../../core'
import { extractFromUserText } from '../extractRequirements'
import { mergeRequirements, missingRequirementFields } from '../memory'
import { emptyMemory, emptyRequirements, type AgentMemory } from '../types'
import { applyConstitutionToTurn } from '../constitution'
import { isAlphaExperienceEnabled } from './feature'

export { SPRINT91_ALPHA_EXPERIENCE_VERSION }

export interface AgentAlphaExperienceRequest {
  conversationId?: string
  userText: string
  memory?: AgentMemory | null
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
  providerRegistry?: ProviderRegistry | null
  enabled?: boolean
  signal?: AbortSignal
}

export interface AgentAlphaExperienceMeta {
  version: string
  conversationId: string
  progressPercent: number
  stageCount: number
  alternativeCount: number
  overallConfidence: number
  recovered: boolean
  constitutionOk: boolean
  estimatedCost: number | null
  currency: string
  durationMs: number
}

export interface AgentAlphaExperienceResponse {
  enabled: boolean
  memory: AgentMemory
  result: AlphaOrchestrationResult | null
  meta: AgentAlphaExperienceMeta | null
  recommendationFacts: string[]
}

export function toAgentAlphaExperienceMeta(
  result: AlphaOrchestrationResult,
): AgentAlphaExperienceMeta {
  return {
    version: result.version,
    conversationId: result.conversationId,
    progressPercent: result.timeline.progressPercent,
    stageCount: result.timeline.stages.length,
    alternativeCount: result.alternativeCount,
    overallConfidence: result.recommendation.confidence.overall,
    recovered: result.recovered,
    constitutionOk: result.constitutionOk,
    estimatedCost: result.recommendation.estimatedCost,
    currency: result.recommendation.currency,
    durationMs: result.durationMs,
  }
}

function requirementsFromMemory(memory: AgentMemory): AlphaOrchestrationRequirements {
  const r = memory.requirements
  return {
    destination: r.destination,
    destinations: r.destinations ?? [],
    origin: r.origin,
    startDate: r.startDate,
    endDate: r.endDate,
    durationDays: r.durationDays,
    travelers: r.travelers,
    travelerType: r.travelerType,
    budgetAmount: r.budgetAmount,
    budgetCurrency: r.budgetCurrency,
    interests: r.interests ?? [],
    mission: r.destination ? `Visit ${r.destination}` : null,
  }
}

/**
 * End-to-end Alpha conversation orchestration via existing engines.
 */
export async function runAlphaExperienceConversation(
  input: AgentAlphaExperienceRequest,
): Promise<AgentAlphaExperienceResponse> {
  if (!isAlphaExperienceEnabled({ enabled: input.enabled })) {
    return {
      enabled: false,
      memory: input.memory ?? emptyMemory(),
      result: null,
      meta: null,
      recommendationFacts: [],
    }
  }

  let memory = input.memory ?? emptyMemory()
  const extracted = extractFromUserText(input.userText, memory.locale)
  memory = {
    ...memory,
    locale: extracted.locale,
    lastIntent: extracted.intent,
    requirements: mergeRequirements(memory.requirements, extracted.patch, {
      replaceDestinations: extracted.flags?.replaceDestinations === true,
    }),
  }
  memory = {
    ...memory,
    missingFields: missingRequirementFields(memory.requirements),
  }

  // Soft defaults so Alpha demo conversations can complete without full intake.
  if (!memory.requirements.destination && !memory.requirements.destinationFlexible) {
    memory = {
      ...memory,
      requirements: {
        ...memory.requirements,
        destination: memory.requirements.destinations[0] ?? 'Dubai',
        destinations: memory.requirements.destinations.length
          ? memory.requirements.destinations
          : ['Dubai'],
      },
    }
  }
  if (!memory.requirements.origin) {
    memory = {
      ...memory,
      requirements: { ...memory.requirements, origin: 'Riyadh' },
    }
  }
  if (!memory.requirements.startDate) {
    memory = {
      ...memory,
      requirements: {
        ...memory.requirements,
        startDate: '2026-08-15',
        endDate: memory.requirements.endDate ?? '2026-08-20',
        durationDays: memory.requirements.durationDays ?? 5,
      },
    }
  }
  if (memory.requirements.budgetAmount == null) {
    memory = {
      ...memory,
      requirements: {
        ...memory.requirements,
        budgetAmount: 8000,
        budgetCurrency: memory.requirements.budgetCurrency ?? 'SAR',
      },
    }
  }
  if (memory.requirements.travelers == null) {
    memory = {
      ...memory,
      requirements: { ...memory.requirements, travelers: 2 },
    }
  }

  const result = await runCoreAlphaExperience({
    conversationId: input.conversationId,
    userText: input.userText,
    intent: extracted.intent,
    requirements: requirementsFromMemory(memory),
    flightOffers: input.flightOffers,
    hotelStays: input.hotelStays,
    providerRegistry: input.providerRegistry ?? null,
    budgetCap: memory.requirements.budgetAmount,
    hasChildren: memory.requirements.travelerType === 'family'
      || (memory.requirements.travelers ?? 0) > 2,
    signal: input.signal,
  })

  const constitution = applyConstitutionToTurn({
    userText: input.userText,
    memory,
    tripPlan: memory.tripPlan,
    replyText: result.recommendation.explanation.summary,
    intent: extracted.intent,
    mission: result.recommendation.tripSummary.destination,
    confidence: result.recommendation.confidence.overall,
    explanation: {
      why: result.recommendation.explanation.whyPackage,
      benefits: [
        result.recommendation.explanation.whyFlight,
        result.recommendation.explanation.whyHotel,
      ],
      tradeoffs: result.recommendation.explanation.tradeoffs,
      confidence: result.recommendation.confidence.overall,
    },
    alternativeCount: result.alternativeCount,
    packagesPresent: result.packageCount > 0,
    recoveredFromFailures: result.recovered,
    endedWithNoResults: result.recommendation.estimatedCost == null && result.packageCount === 0,
  })

  const recommendationFacts = [
    ...constitution.recommendationFacts,
    result.recommendation.explanation.summary,
    result.recommendation.confidence.reasoningSummary,
    ...result.recommendation.alternatives.slice(0, 3).map((a) => a.explanation),
  ].filter(Boolean)

  return {
    enabled: true,
    memory: {
      ...memory,
      missingFields: missingRequirementFields(memory.requirements),
    },
    result: {
      ...result,
      constitutionOk: constitution.validation?.ok !== false && result.constitutionOk,
    },
    meta: toAgentAlphaExperienceMeta(result),
    recommendationFacts,
  }
}

export function enrichWithAlphaExperience(input: {
  memory: AgentMemory
  userText: string
  conversationId?: string
  enabled?: boolean
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
}): Promise<AgentAlphaExperienceResponse> {
  return runAlphaExperienceConversation({
    memory: input.memory,
    userText: input.userText,
    conversationId: input.conversationId,
    enabled: input.enabled,
    flightOffers: input.flightOffers,
    hotelStays: input.hotelStays,
  })
}

/** Convenience for tests that need empty requirements. */
export function blankRequirementsMemory(): AgentMemory {
  return {
    ...emptyMemory(),
    requirements: emptyRequirements(),
  }
}
