/**
 * Sprint 42 — extract structured conversation payloads from message providerMeta.
 * Does not invent planning — reads Sprint 32 StreamingResponse meta.
 */

import type { ConversationStructuredResponse, ConversationSuggestedAction } from '../conversationExperience/types'
import type { UnifiedTravelPlanOption } from '../../brain/unifiedTravel/types'

export interface ConversationUiMeta {
  conversationUi: boolean
  structured: ConversationStructuredResponse | null
  payNow: boolean
  estimatedTotal: number | null
  tripQuery: boolean
  memory: Record<string, unknown> | null
}

export function extractConversationUiMeta(providerMeta: Record<string, unknown> | null | undefined): ConversationUiMeta {
  const meta = providerMeta ?? {}
  const structured = isStructured(meta.structured) ? meta.structured : null
  return {
    conversationUi: meta.conversationUi === true || structured != null,
    structured,
    payNow: meta.payNow === true || Boolean((meta as { payNowOffer?: unknown }).payNowOffer),
    estimatedTotal: typeof meta.estimatedTotal === 'number' ? meta.estimatedTotal : null,
    tripQuery: meta.tripQuery === true,
    memory: isRecord(meta.memory) ? meta.memory : null,
  }
}

export function pickTopPlan(structured: ConversationStructuredResponse | null): UnifiedTravelPlanOption | null {
  if (!structured) return null
  if (structured.topPlanId) {
    return structured.plans.find((p) => p.id === structured.topPlanId) ?? structured.plans[0] ?? null
  }
  return structured.plans[0] ?? null
}

export function suggestedActionsFromStructured(
  structured: ConversationStructuredResponse | null,
): ConversationSuggestedAction[] {
  return structured?.suggestedFollowUpActions ?? []
}

function isStructured(value: unknown): value is ConversationStructuredResponse {
  if (!value || typeof value !== 'object') return false
  const row = value as ConversationStructuredResponse
  return typeof row.summary === 'string' && Array.isArray(row.flights) && Array.isArray(row.hotels)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
