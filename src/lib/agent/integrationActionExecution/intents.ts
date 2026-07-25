/**
 * Integration Sprint 11 — conversational action intent detection.
 */

import type { ActionIntent, ActionKind } from './types'

export function detectActionKind(userText: string | null | undefined): ActionKind | null {
  const t = (userText ?? '').trim()
  if (!t) return null

  if (/cancel (my )?booking|cancel (the )?reservation|ألغِ?\s*(الحجز|حجزي)|إلغاء\s*الحجز/i.test(t)) {
    return 'cancel_booking'
  }
  if (
    /change (my )?return|modify (my )?booking|change (my )?flight|عدّل\s*الحجز|غير\s*رحلة\s*العودة|تعديل\s*الحجز/i
      .test(t)
  ) {
    return 'modify_booking'
  }
  if (/reserve (this |the )?hotel|book (this |the )?hotel|احجز\s*(هذا\s*)?الفندق|احجز\s*فندق/i.test(t)) {
    return 'reserve_hotel'
  }
  if (/share (my )?itinerary|share (my )?trip|شارك\s*(رحلتي|خطتي|المسار)/i.test(t)) {
    return 'share_trip'
  }
  if (/save (my )?itinerary|save (the )?trip|احفظ\s*(الرحلة|خطتي|المسار)/i.test(t)) {
    return 'save_itinerary'
  }
  if (
    /^book it\.?$/i.test(t)
    || /book (the |this )?flight|book (it|now)|احجز(ها|ه|ها لي)?|احجز\s*الرحلة/i.test(t)
  ) {
    return 'book_flight'
  }
  return null
}

export function detectActionIntent(userText: string | null | undefined): ActionIntent {
  const t = (userText ?? '').trim()
  if (!t) return 'unknown'
  if (
    /^(yes|yep|confirm|confirmed|go ahead|do it|أؤكد|نعم|موافق|أكد)[.!]?$/i.test(t)
    || /confirm (the )?(booking|cancellation|modification|payment|action)/i.test(t)
    || /أؤكد\s*(الحجز|الإلغاء|التعديل|الدفع)/i.test(t)
  ) {
    return 'confirm_action'
  }
  if (/^(no|nope|cancel that|never mind|لا|ألغِ الأمر|تراجع)[.!]?$/i.test(t)) {
    return 'decline_action'
  }
  if (detectActionKind(t)) return 'request_action'
  return 'unknown'
}

export function isActionAsk(userText: string | null | undefined): boolean {
  const intent = detectActionIntent(userText)
  return intent !== 'unknown'
}

export function confirmationKindFor(action: ActionKind): 'booking' | 'cancellation' | 'modification' | 'payment' | 'none' {
  switch (action) {
    case 'book_flight':
    case 'reserve_hotel':
      return 'booking'
    case 'cancel_booking':
      return 'cancellation'
    case 'modify_booking':
      return 'modification'
    case 'save_itinerary':
    case 'share_trip':
      return 'none'
  }
}
