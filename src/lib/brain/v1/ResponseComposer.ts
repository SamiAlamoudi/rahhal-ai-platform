/**
 * Sprint 82 — ResponseComposer (Brain v1).
 * Natural conversational answers with explainability.
 */

import type { BrainV1Plan } from './ConversationPlanner'
import type {
  BrainV1Clarification,
  BrainV1Entities,
  BrainV1Explanation,
  BrainV1Intent,
  BrainV1Offer,
  BrainV1PlannerState,
} from './types'

export class ResponseComposer {
  compose(input: {
    intent: BrainV1Intent
    entities: BrainV1Entities
    plan: BrainV1Plan
    clarification?: BrainV1Clarification | null
    topOffer?: BrainV1Offer | null
    explanation?: BrainV1Explanation | null
    planner?: BrainV1PlannerState | null
  }): {
    ar: string
    en: string
    bookingActions: Array<{ type: string; label: string; payload?: Record<string, unknown> }>
  } {
    const clarify =
      input.clarification
      ?? (input.plan.kind === 'clarify' ? input.plan.clarification : null)
      ?? (input.plan.kind === 'resume' ? input.plan.clarification ?? null : null)

    if ((input.plan.kind === 'clarify' || input.plan.kind === 'resume') && clarify) {
      const resumePrefixEn = input.planner?.resumed
        ? 'Welcome back — continuing where we left off. '
        : ''
      const resumePrefixAr = input.planner?.resumed
        ? 'مرحباً بعودتك — نكمل من حيث توقفنا. '
        : ''
      return {
        ar: `${resumePrefixAr}${clarify.questionAr}`,
        en: `${resumePrefixEn}${clarify.questionEn}`,
        bookingActions: [],
      }
    }

    if (input.intent === 'general_conversation') {
      return {
        ar: 'مرحباً! أنا بيلامو، مستشارك للسفر. إلى أين تفكر تسافر؟',
        en: 'Hello! I am Bilamo, your travel consultant. Where are you thinking of going?',
        bookingActions: [],
      }
    }

    if (input.intent === 'visa_question') {
      const dest = input.entities.visaDestination ?? input.entities.destination ?? 'وجهتك'
      return {
        ar: `بخصوص التأشيرة إلى ${dest}: أخبرني بجنسيتك ومدة الإقامة ل أعطيك توجيهاً أدق.`,
        en: `Regarding a visa for ${dest}: tell me your nationality and stay length for clearer guidance.`,
        bookingActions: [],
      }
    }

    if (input.topOffer) {
      const whyEn = input.explanation?.en
        ?? (input.topOffer.reasons?.[0]
          ? `Why: ${input.topOffer.reasons[0]}.`
          : 'Why: best overall fit.')
      const whyAr = input.explanation?.ar
        ?? (input.topOffer.reasons?.[0]
          ? `السبب: ${input.topOffer.reasons[0]}.`
          : 'السبب: الأنسب إجمالاً.')
      const resumeEn = input.planner?.resumed ? 'Continuing your search — ' : ''
      const resumeAr = input.planner?.resumed ? 'نكمل بحثك — ' : ''
      return {
        ar: `${resumeAr}أقترح لك: ${input.topOffer.title} بسعر ${input.topOffer.price ?? '—'} ${input.topOffer.currency}. ${whyAr} هل نجهّز خطوة الحجز؟`,
        en: `${resumeEn}I recommend: ${input.topOffer.title} at ${input.topOffer.price ?? '—'} ${input.topOffer.currency}. ${whyEn} Shall I prepare booking?`,
        bookingActions: [{
          type: 'prepare_booking',
          label: 'Prepare booking',
          payload: { offerId: input.topOffer.id, kind: input.topOffer.kind },
        }],
      }
    }

    const dest = input.entities.destination
    if (dest) {
      return {
        ar: `حسناً، لنخطط رحلتك إلى ${dest}. سأجمع أفضل الخيارات عندما تكتمل التفاصيل.`,
        en: `Great — let's plan your trip to ${dest}. I'll gather the best options once details are complete.`,
        bookingActions: [],
      }
    }

    return {
      ar: 'أخبرني وجهتك وموعد سفرك وسأرتب لك أفضل الخيارات.',
      en: 'Tell me your destination and travel dates and I will arrange the best options.',
      bookingActions: [],
    }
  }
}

export function createResponseComposer(): ResponseComposer {
  return new ResponseComposer()
}
