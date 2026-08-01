/**
 * Sprint 81 — ResponseComposer (Brain v1).
 * Natural conversational answers (foundation templates).
 */

import type { BrainV1Plan } from './ConversationPlanner'
import type {
  BrainV1Clarification,
  BrainV1Entities,
  BrainV1Intent,
  BrainV1Offer,
} from './types'

export class ResponseComposer {
  compose(input: {
    intent: BrainV1Intent
    entities: BrainV1Entities
    plan: BrainV1Plan
    clarification?: BrainV1Clarification | null
    topOffer?: BrainV1Offer | null
  }): { ar: string; en: string; bookingActions: Array<{ type: string; label: string; payload?: Record<string, unknown> }> } {
    if (input.plan.kind === 'clarify' && input.clarification) {
      return {
        ar: input.clarification.questionAr,
        en: input.clarification.questionEn,
        bookingActions: [],
      }
    }

    if (input.intent === 'general_conversation') {
      return {
        ar: 'مرحباً! أنا رحّال، مستشارك للسفر. إلى أين تفكر تسافر؟',
        en: 'Hello! I am Rahhal, your travel consultant. Where are you thinking of going?',
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
      const why = input.topOffer.reasons?.[0] ?? 'best overall fit'
      return {
        ar: `أقترح لك: ${input.topOffer.title} بسعر ${input.topOffer.price ?? '—'} ${input.topOffer.currency}. السبب: ${why}. هل نجهّز خطوة الحجز؟`,
        en: `I recommend: ${input.topOffer.title} at ${input.topOffer.price ?? '—'} ${input.topOffer.currency}. Why: ${why}. Shall I prepare booking?`,
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
