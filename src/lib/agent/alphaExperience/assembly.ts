/**
 * Sprint 99 — assemble unified AlphaExperienceDTO from existing turn outputs.
 * Presentation only — no new intelligence, search, or decision making.
 */

import {
  composeAlphaTravelerExperience,
  SPRINT99_ALPHA_ASSEMBLY_VERSION,
  type AlphaExperienceComposeInput,
  type AlphaExperienceDTO,
} from '../../../core'
import type { ConciergeTurnIntegrationResult } from '../conciergeIntegration'
import type { AgentMemory } from '../types'
import { isAlphaExperienceEnabled } from './feature'

export { SPRINT99_ALPHA_ASSEMBLY_VERSION }

export interface AssembleAlphaTravelerExperienceInput {
  conversationId?: string
  memory: AgentMemory
  conciergeIntegration?: ConciergeTurnIntegrationResult | null
  packageSelected?: {
    id: string
    title?: string | null
    totalPrice?: number | null
    currency?: string | null
    confidence?: number | null
    explanation?: string | null
    components?: Array<{
      kind: string
      id: string
      title?: string
      price?: number
      currency?: string
      payload?: Record<string, unknown>
    }>
  } | null
  flightOffers?: Array<Record<string, unknown>> | null
  hotelOffers?: Array<Record<string, unknown>> | null
  decisionExplanation?: string | null
  priceTimingNote?: string | null
  priceConfidence?: number | null
  engineConfidence?: number | null
  /** Explicit override (tests). */
  enabled?: boolean
}

export interface AgentAlphaTravelerExperienceMeta {
  version: string
  conversationId: string
  enabled: boolean
  sectionIds: string[]
  sectionCount: number
  finalRecommendation: string | null
  confidenceLevel: string | null
  confidenceScore: number | null
  nextAction: string | null
  durationMs: number
}

/**
 * Compact meta for AgentProviderMeta (additive).
 * Full DTO lives on `experience` for Future UI consumers.
 */
export interface AgentAlphaTravelerExperienceAttachment {
  meta: AgentAlphaTravelerExperienceMeta
  experience: AlphaExperienceDTO
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function pickFlight(
  input: AssembleAlphaTravelerExperienceInput,
): AlphaExperienceComposeInput['flight'] {
  const fromOffer = input.flightOffers?.[0]
  if (fromOffer) {
    const id = str(fromOffer.id) ?? 'flight_0'
    return {
      id,
      airline: str(fromOffer.airline),
      origin: str(fromOffer.origin),
      destination: str(fromOffer.destination),
      price: num(fromOffer.price),
      currency: str(fromOffer.currency),
      durationMinutes: num(fromOffer.durationMinutes),
      stops: num(fromOffer.stops),
    }
  }

  const component = input.packageSelected?.components?.find((c) => c.kind === 'flight')
  if (!component?.id) return null
  const payload = component.payload ?? {}
  return {
    id: component.id,
    airline: str(payload.airline) ?? str(component.title),
    origin: str(payload.origin),
    destination: str(payload.destination),
    price: num(component.price) ?? num(payload.price),
    currency: str(component.currency) ?? str(payload.currency),
    durationMinutes: num(payload.durationMinutes),
    stops: num(payload.stops),
  }
}

function pickHotel(
  input: AssembleAlphaTravelerExperienceInput,
): AlphaExperienceComposeInput['hotel'] {
  const fromOffer = input.hotelOffers?.[0]
  if (fromOffer) {
    const id = str(fromOffer.id) ?? 'hotel_0'
    return {
      id,
      name: str(fromOffer.name),
      price: num(fromOffer.price),
      currency: str(fromOffer.currency),
      stars: num(fromOffer.stars),
      rating: num(fromOffer.rating),
    }
  }

  const component = input.packageSelected?.components?.find((c) => c.kind === 'hotel')
  if (!component?.id) return null
  const payload = component.payload ?? {}
  return {
    id: component.id,
    name: str(payload.name) ?? str(component.title),
    price: num(component.price) ?? num(payload.price),
    currency: str(component.currency) ?? str(payload.currency),
    stars: num(payload.stars),
    rating: num(payload.rating),
  }
}

/**
 * Map existing concierge + engine snapshots into AlphaExperienceComposeInput.
 */
export function toAlphaExperienceComposeInput(
  input: AssembleAlphaTravelerExperienceInput,
): AlphaExperienceComposeInput {
  const rec = input.conciergeIntegration?.recommendation
  const result = input.conciergeIntegration?.result
  const req = input.memory.requirements
  const currency = req.budgetCurrency ?? input.packageSelected?.currency ?? 'SAR'

  return {
    conversationId: input.conversationId
      ?? result?.conversationId
      ?? undefined,
    destination: req.destination,
    origin: req.origin,
    currency,
    concierge: rec?.conciergeEnabled || result
      ? {
        enabled: Boolean(rec?.conciergeEnabled || result),
        explanation: rec?.explanation
          ?? result?.explanation.summary
          ?? null,
        summaryText: rec?.summary?.text
          ?? result?.conversationSummary.text
          ?? null,
        recommendedOption: rec?.summary?.recommendedOptionLabel
          ?? result?.conversationSummary.recommendedOptionLabel
          ?? null,
        nextStep: rec?.summary?.nextStep
          ?? result?.conversationSummary.nextStep
          ?? null,
        confidence: rec?.confidence
          ?? (result
            ? {
              score: result.confidence.score,
              level: result.confidence.level,
              label: result.confidence.label,
              uncertaintyExplanation: result.confidence.uncertaintyExplanation,
            }
            : null),
        timeline: rec?.timeline
          ?? (result
            ? {
              stages: result.timeline.stages.map((s) => ({
                id: s.id,
                label: s.label,
                status: s.status,
                message: s.message,
                progressPercent: s.progressPercent,
              })),
              currentStageId: result.timeline.currentStageId,
              progressPercent: result.timeline.progressPercent,
            }
            : null),
        alternatives: (rec?.alternatives ?? result?.alternatives ?? []).map((a) => ({
          kind: a.kind,
          label: a.label,
          estimatedCost: a.estimatedCost ?? null,
          currency: a.currency,
          explanation: a.explanation,
        })),
        suggestions: (rec?.suggestions ?? result?.suggestions ?? []).map((s) => ({
          title: s.title,
          message: s.message,
        })),
        whyDestination: result?.explanation.whyDestination ?? null,
        whyFlights: result?.explanation.whyFlights ?? null,
        whyHotel: result?.explanation.whyHotel ?? null,
        whyPackage: result?.explanation.whyPackage ?? null,
        whyTiming: result?.explanation.whyTiming ?? null,
      }
      : null,
    packageSelected: input.packageSelected
      ? {
        id: input.packageSelected.id,
        title: input.packageSelected.title ?? null,
        totalPrice: input.packageSelected.totalPrice ?? null,
        currency: input.packageSelected.currency ?? currency,
        confidence: input.packageSelected.confidence ?? null,
        explanation: input.packageSelected.explanation ?? null,
      }
      : null,
    flight: pickFlight(input),
    hotel: pickHotel(input),
    priceOpportunity: input.priceTimingNote
      ? {
        note: input.priceTimingNote,
        confidence: input.priceConfidence ?? null,
        currency,
      }
      : null,
    decisionExplanation: input.decisionExplanation ?? null,
    engineConfidence: input.engineConfidence ?? null,
  }
}

export function toAgentAlphaTravelerExperienceMeta(
  dto: AlphaExperienceDTO,
): AgentAlphaTravelerExperienceMeta {
  return {
    version: dto.version,
    conversationId: dto.conversationId,
    enabled: dto.enabled,
    sectionIds: [...dto.sectionIds],
    sectionCount: dto.sections.length,
    finalRecommendation: dto.finalRecommendation,
    confidenceLevel: dto.confidenceLevel,
    confidenceScore: dto.confidenceScore,
    nextAction: dto.nextAction,
    durationMs: dto.durationMs,
  }
}

/**
 * Assemble unified traveler experience for a conversation turn.
 * Flag OFF → null (legacy path unchanged).
 */
export function assembleAlphaTravelerExperience(
  input: AssembleAlphaTravelerExperienceInput,
): AgentAlphaTravelerExperienceAttachment | null {
  if (!isAlphaExperienceEnabled({ enabled: input.enabled })) {
    return null
  }

  const composeInput = toAlphaExperienceComposeInput(input)
  const experience = composeAlphaTravelerExperience(composeInput, { enabled: true })

  return {
    meta: toAgentAlphaTravelerExperienceMeta(experience),
    experience,
  }
}
