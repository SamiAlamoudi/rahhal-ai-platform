/**
 * Integration Sprint 11 — confirmation gate (booking / cancel / modify / payment).
 */

import type { ActionConfirmationGate, ActionConfirmationKind, ActionKind } from './types'
import { confirmationKindFor } from './intents'

const PROMPTS: Record<Exclude<ActionConfirmationKind, 'none'>, { en: string; ar: string }> = {
  booking: {
    en: 'Please confirm before I book (reply “confirm” / “أؤكد”). No live booking will run.',
    ar: 'أكد قبل الحجز (اكتب «أؤكد»). لن يتم حجز حي.',
  },
  cancellation: {
    en: 'Please confirm cancellation (reply “confirm”). This stays preview/mock until live is enabled.',
    ar: 'أكد الإلغاء (اكتب «أؤكد»). يبقى معاينة/تجريبي حتى تفعيل الحي.',
  },
  modification: {
    en: 'Please confirm the modification (reply “confirm”). Preview/mock only for now.',
    ar: 'أكد التعديل (اكتب «أؤكد»). معاينة/تجريبي فقط حالياً.',
  },
  payment: {
    en: 'Please confirm payment (reply “confirm”). Payment gateway is not live yet.',
    ar: 'أكد الدفع (اكتب «أؤكد»). بوابة الدفع غير مفعّلة بعد.',
  },
}

export function buildConfirmationGate(input: {
  action: ActionKind
  confirmed: boolean
  /** Soft payment cue on booking actions. */
  paymentCue?: boolean
}): ActionConfirmationGate {
  let kind = confirmationKindFor(input.action)
  if (input.paymentCue && (kind === 'booking' || kind === 'none')) {
    kind = 'payment'
  }
  if (kind === 'none') {
    return {
      required: false,
      kind: 'none',
      confirmed: true,
      promptEn: '',
      promptAr: '',
    }
  }
  const prompts = PROMPTS[kind]
  return {
    required: true,
    kind,
    confirmed: input.confirmed,
    promptEn: prompts.en,
    promptAr: prompts.ar,
  }
}

export function requiresConfirmation(action: ActionKind): boolean {
  return confirmationKindFor(action) !== 'none'
}
