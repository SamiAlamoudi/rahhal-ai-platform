/**
 * Concierge replies for confirmation queries — Sprint 9 consultant voice.
 */

import { emptyRequirements } from '../agent/types'
import type { AgentLocale } from '../agent/types'
import { buildConsultantReply } from '../concierge/consultantVoice'
import {
  advanceConciergeState,
  emptyConciergeState,
  emptySoftSignals,
} from '../concierge'
import type { ConfirmationState } from './types'
import type { BookingRecord } from '../booking'

export type ConfirmationConciergeIntent =
  | 'booking_confirmed'
  | 'show_confirmation'
  | 'booking_reference'
  | 'booking_status'

function informDecision(heard: string[], rationale: string) {
  return {
    action: 'propose_options' as const,
    phase: 'advising' as const,
    state: advanceConciergeState({
      previous: emptyConciergeState(),
      phase: 'advising',
      lastAction: 'propose_options',
      softSignals: emptySoftSignals(),
      heardSummary: heard,
    }),
    askFields: [] as never[],
    shouldExecuteAgent: false,
    rationale,
  }
}

export function buildConfirmationConciergeReply(input: {
  intent: ConfirmationConciergeIntent
  state: ConfirmationState | null
  record?: BookingRecord | null
  locale: AgentLocale
}): string {
  const { intent, state, record, locale } = input
  if (!state) {
    return buildConsultantReply({
      locale,
      decision: informDecision([], 'no-confirmation'),
      requirements: emptyRequirements(),
      optionLines: [
        locale === 'ar'
          ? 'لا أجد تأكيداً لهذا الحجز بعد. افتح رحلاتي أو أكمل الحجز أولاً.'
          : 'I cannot find a confirmation for this booking yet. Open My Trips or complete the booking first.',
      ],
    })
  }

  const ref = state.confirmationReference
  const status = state.status
  const route = record?.flight
    ? `${record.flight.origin} → ${record.flight.destination}`
    : (record?.itemTitles[0] ?? '')

  switch (intent) {
    case 'booking_confirmed': {
      const line = status === 'confirmed'
        ? (locale === 'ar'
          ? `نعم — تم تأكيد حجزك (${ref}).`
          : `Yes — your booking is confirmed (${ref}).`)
        : status === 'confirming'
          ? (locale === 'ar'
            ? 'الحجز قيد التأكيد مع المزوّد الآن.'
            : 'Your booking is currently being confirmed with the supplier.')
          : status === 'failed'
            ? (locale === 'ar'
              ? 'لم يتم التأكيد بعد — فشلت المحاولة الأخيرة. يمكنك إعادة المحاولة.'
              : 'Not confirmed yet — the last attempt failed. You can retry.')
            : (locale === 'ar'
              ? 'لم يتم التأكيد بعد — الحجز ما زال معلقاً.'
              : 'Not confirmed yet — the booking is still pending.')
      return buildConsultantReply({
        locale,
        decision: informDecision([ref, status], 'booking-confirmed-q'),
        requirements: emptyRequirements(),
        optionLines: [line, route].filter(Boolean),
      })
    }
    case 'show_confirmation':
      return buildConsultantReply({
        locale,
        decision: informDecision([ref], 'show-confirmation'),
        requirements: emptyRequirements(),
        optionLines: [
          locale === 'ar' ? `ملخص التأكيد:` : 'Confirmation summary:',
          locale === 'ar' ? `المرجع: ${ref}` : `Reference: ${ref}`,
          locale === 'ar' ? `الحالة: ${status}` : `Status: ${status}`,
          route,
          state.supplierReference
            ? (locale === 'ar'
              ? `مرجع المزوّد: ${state.supplierReference}`
              : `Supplier reference: ${state.supplierReference}`)
            : (locale === 'ar' ? 'مرجع المزوّد: بانتظار' : 'Supplier reference: pending'),
        ].filter(Boolean),
      })
    case 'booking_reference':
      return buildConsultantReply({
        locale,
        decision: informDecision([ref], 'booking-reference'),
        requirements: emptyRequirements(),
        optionLines: [
          locale === 'ar'
            ? `مرجع حجزك هو ${ref}.`
            : `Your booking reference is ${ref}.`,
        ],
      })
    case 'booking_status':
      return buildConsultantReply({
        locale,
        decision: informDecision([status], 'booking-status'),
        requirements: emptyRequirements(),
        optionLines: [
          locale === 'ar'
            ? `حالة الحجز الحالية: ${status}. المرجع: ${ref}.`
            : `Current booking status: ${status}. Reference: ${ref}.`,
        ],
      })
    default:
      return buildConsultantReply({
        locale,
        decision: informDecision([ref], 'confirmation-fallback'),
        requirements: emptyRequirements(),
        optionLines: [ref, status],
      })
  }
}

export function buildConfirmationScreenSummary(
  state: ConfirmationState,
  locale: AgentLocale = 'en',
): string {
  return buildConfirmationConciergeReply({
    intent: 'show_confirmation',
    state,
    locale,
  })
}
