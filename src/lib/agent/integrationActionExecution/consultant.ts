/**
 * Integration Sprint 11 — natural action / confirmation summaries.
 */

import type { ActionExecutionResult } from './types'

export function buildActionExecutionSummary(
  result: Pick<
    ActionExecutionResult,
    'action' | 'intent' | 'confirmation' | 'execution' | 'validation' | 'mode'
  >,
): { en: string; ar: string } {
  if (!result.action) {
    return {
      en: 'Tell me what to do — book a flight, reserve a hotel, save/share itinerary, change or cancel a booking.',
      ar: 'أخبرني بما تريد — حجز رحلة، حجز فندق، حفظ/مشاركة الخطة، تعديل أو إلغاء حجز.',
    }
  }

  if (result.validation && !result.validation.ok) {
    return {
      en: `I can’t run ${result.action} yet — missing: ${result.validation.missing.join(', ')}.`,
      ar: `لا أستطيع تنفيذ ${result.action} بعد — ناقص: ${result.validation.missing.join('، ')}.`,
    }
  }

  if (result.confirmation?.required && !result.confirmation.confirmed) {
    return {
      en: [
        `Ready to ${result.action.replace(/_/g, ' ')} in ${result.mode} mode.`,
        result.confirmation.promptEn,
      ].join(' '),
      ar: [
        `جاهز لـ ${result.action} بوضع ${result.mode}.`,
        result.confirmation.promptAr,
      ].join(' '),
    }
  }

  if (result.execution) {
    const e = result.execution
    if (e.liveBlocked) {
      return { en: e.detailEn, ar: e.detailAr }
    }
    return {
      en: [
        e.detailEn,
        e.reference ? `Reference: ${e.reference}.` : null,
        'No accidental live booking — safe execution only.',
      ].filter(Boolean).join(' '),
      ar: [
        e.detailAr,
        e.reference ? `المرجع: ${e.reference}.` : null,
        'لا حجز حي بالخطأ — تنفيذ آمن فقط.',
      ].filter(Boolean).join(' '),
    }
  }

  return {
    en: `Action ${result.action} noted (${result.mode}).`,
    ar: `الإجراء ${result.action} مُسجّل (${result.mode}).`,
  }
}
