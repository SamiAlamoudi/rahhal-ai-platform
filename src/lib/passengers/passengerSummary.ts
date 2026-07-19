/**
 * Concierge passenger summary — reuses Sprint 9 consultant voice (no hardcoded UI stubs).
 */

import { emptyRequirements } from '../agent/types'
import type { AgentLocale } from '../agent/types'
import { buildConsultantReply } from '../concierge/consultantVoice'
import {
  advanceConciergeState,
  emptyConciergeState,
  emptySoftSignals,
} from '../concierge'
import type { Passenger, TravellerCounts } from './types'
import { normalizeTravellerCounts } from './createPassengerSlots'

export interface PassengerConciergeSummaryInput {
  counts: TravellerCounts
  passengers?: Passenger[]
  locale?: AgentLocale
  /** When true, remind about passport expiry verification. */
  remindPassportExpiry?: boolean
}

export interface PassengerConciergeSummary {
  locale: AgentLocale
  summaryText: string
  partyLine: string
  passportHint: string
}

function partyLine(locale: AgentLocale, counts: TravellerCounts): string {
  const c = normalizeTravellerCounts(counts)
  if (locale === 'ar') {
    const parts: string[] = []
    if (c.adults > 0) parts.push(`${c.adults === 1 ? 'بالغ واحد' : `${c.adults} بالغين`}`)
    if (c.children > 0) parts.push(`${c.children === 1 ? 'طفل واحد' : `${c.children} أطفال`}`)
    if (c.infants > 0) parts.push(`${c.infants === 1 ? 'رضيع واحد' : `${c.infants} رضع`}`)
    return `تسافر مع ${parts.join(' و')}.`
  }
  const parts: string[] = []
  if (c.adults > 0) parts.push(`${c.adults} adult${c.adults === 1 ? '' : 's'}`)
  if (c.children > 0) parts.push(`${c.children} child${c.children === 1 ? '' : 'ren'}`)
  if (c.infants > 0) parts.push(`${c.infants} infant${c.infants === 1 ? '' : 's'}`)
  return `You are travelling with ${parts.join(' and ')}.`
}

function passportHint(locale: AgentLocale): string {
  return locale === 'ar'
    ? 'يرجى التحقق من تواريخ انتهاء جوازات السفر قبل المتابعة.'
    : 'Please verify passport expiry dates before continuing.'
}

function incompleteHint(locale: AgentLocale, passengers: Passenger[]): string | null {
  const incomplete = passengers.filter((p) => !p.firstName.trim() || !p.lastName.trim() || !p.passportNumber.trim())
  if (incomplete.length === 0) return null
  return locale === 'ar'
    ? `ما زال هناك ${incomplete.length} مسافر بحاجة لاستكمال البيانات.`
    : `${incomplete.length} passenger${incomplete.length === 1 ? '' : 's'} still need details completed.`
}

/**
 * Build a concierge summary above the passenger form / booking summary.
 * Delegates scaffolding to `buildConsultantReply`.
 */
export function buildPassengerConciergeSummary(
  input: PassengerConciergeSummaryInput,
): PassengerConciergeSummary {
  const locale = input.locale ?? 'en'
  const counts = normalizeTravellerCounts(input.counts)
  const party = partyLine(locale, counts)
  const passport = input.remindPassportExpiry === false ? '' : passportHint(locale)
  const incomplete = input.passengers ? incompleteHint(locale, input.passengers) : null

  const optionLines = [party, passport, incomplete].filter((line): line is string => Boolean(line))

  const decision = {
    action: 'advise' as const,
    phase: 'confirming' as const,
    state: advanceConciergeState({
      previous: emptyConciergeState(),
      phase: 'confirming',
      lastAction: 'advise',
      softSignals: emptySoftSignals(),
      heardSummary: [
        `adults:${counts.adults}`,
        `children:${counts.children}`,
        `infants:${counts.infants}`,
      ],
    }),
    askFields: [],
    shouldExecuteAgent: false,
    rationale: 'passenger-booking-summary',
  }

  const summaryText = buildConsultantReply({
    locale,
    decision,
    requirements: {
      ...emptyRequirements(),
      travelers: counts.total,
      travelerType: counts.total === 1 ? 'solo' : counts.adults === 2 && counts.total === 2 ? 'couple' : 'family',
    },
    optionLines,
  })

  return {
    locale,
    summaryText,
    partyLine: party,
    passportHint: passport,
  }
}
