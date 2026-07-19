/**
 * Sprint 32 — ResponseComposer
 * Maps UnifiedTravelPlanResult → ConversationStructuredResponse (no planning logic).
 */

import type { UnifiedTravelPlanResult } from '../../brain/unifiedTravel'
import type {
  ConversationPhase,
  ConversationStructuredResponse,
  ConversationSuggestedAction,
} from './types'

export class ResponseComposer {
  compose(input: {
    planResult: UnifiedTravelPlanResult | null
    phase: ConversationPhase
    locale: 'ar' | 'en'
    compareMode?: boolean
    clarificationQuestion?: string | null
  }): ConversationStructuredResponse {
    const plan = input.planResult
    const top = plan?.topPlan ?? null
    const plans = input.compareMode
      ? (plan?.plans ?? [])
      : top
        ? [top, ...(plan?.alternatives ?? []).slice(0, 2)]
        : (plan?.plans ?? [])

    const summary = input.clarificationQuestion
      ? input.clarificationQuestion
      : plan?.headline
        || (input.locale === 'ar' ? 'إليك خطة السفر' : 'Here is your travel plan')

    return {
      summary,
      flights: plans
        .map((p) => p.flight)
        .filter((f): f is NonNullable<typeof f> => Boolean(f))
        .map((f) => ({
          id: f.id,
          airline: f.airline,
          from: f.from,
          to: f.to,
          cabin: f.cabin,
          price: f.price,
          currency: f.currency,
          stops: f.stops,
        })),
      hotels: plans
        .map((p) => p.hotel)
        .filter((h): h is NonNullable<typeof h> => Boolean(h))
        .map((h) => ({
          id: h.id,
          name: h.name,
          area: h.area,
          stars: h.stars,
          nightly: h.nightly,
          currency: h.currency,
        })),
      dailyItinerary: top?.itinerary.map((d) => ({
        day: d.day,
        date: d.date,
        title: d.title,
        summary: d.summary,
        items: [...d.items],
      })) ?? [],
      estimatedTotalCost: top?.cost ?? plan?.costSummary ?? null,
      confidenceScore: plan?.confidenceScore ?? top?.confidence ?? 0,
      reasoning: [
        ...(plan?.reasoning ?? []),
        ...(top?.reasons ?? []),
      ].slice(0, 8),
      suggestedFollowUpActions: buildSuggestedActions(input.locale, input.phase, Boolean(top)),
      plans,
      topPlanId: top?.id ?? null,
      followUps: plan?.followUps ?? [],
      phase: input.phase,
    }
  }
}

export function createResponseComposer(): ResponseComposer {
  return new ResponseComposer()
}

function buildSuggestedActions(
  locale: 'ar' | 'en',
  phase: ConversationPhase,
  hasPlan: boolean,
): ConversationSuggestedAction[] {
  if (phase === 'clarifying' || !hasPlan) {
    return locale === 'ar'
      ? [{ id: 'travelers', label: 'عدد المسافرين', commandHint: '2 adults' }]
      : [{ id: 'travelers', label: 'Add travelers', commandHint: '2 adults' }]
  }

  if (locale === 'ar') {
    return [
      { id: 'cheaper', label: 'اجعلها أرخص', commandHint: 'Make it cheaper' },
      { id: 'direct', label: 'رحلات مباشرة فقط', commandHint: 'Only direct flights' },
      { id: 'upgrade', label: 'ترقية الفندق', commandHint: 'Upgrade hotel' },
      { id: 'compare', label: 'قارن الخيارات', commandHint: 'Compare options' },
    ]
  }

  return [
    { id: 'cheaper', label: 'Make it cheaper', commandHint: 'Make it cheaper' },
    { id: 'direct', label: 'Only direct flights', commandHint: 'Only direct flights' },
    { id: 'upgrade', label: 'Upgrade hotel', commandHint: 'Upgrade hotel' },
    { id: 'compare', label: 'Compare options', commandHint: 'Compare options' },
  ]
}
