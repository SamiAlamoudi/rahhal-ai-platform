/**
 * Executive AI Travel Consultant — single Current Goal for the consultation turn.
 * Distinct from ConversationObjective (internal routing). One of five funnel stages.
 */

import type { TravelFacts } from './travelFacts'

export const EXECUTIVE_CURRENT_GOALS = [
  'Collect destination',
  'Recommend flights',
  'Compare hotels',
  'Finalize booking',
  'Confirm itinerary',
] as const

export type ExecutiveCurrentGoal = (typeof EXECUTIVE_CURRENT_GOALS)[number]

const BOOKING_INTENTS = new Set([
  'booking_confirmed',
  'show_confirmation',
  'booking_reference',
  'booking_status',
  'how_much_will_i_pay',
  'is_order_ready',
  'show_checkout',
  'what_is_payment_status',
  'show_latest_booking',
  'show_booking_details',
])

function destinationKnown(known: TravelFacts['known']): boolean {
  return Boolean(known.destination?.trim() || known.destinations?.some((d) => d.trim()))
}

function lodgingFocus(facts: {
  known: TravelFacts['known']
  missingSlots: string[]
  lastIntent?: string
  softSignals?: Record<string, unknown>
  optionHints?: string[]
}): boolean {
  if (facts.known.hotelPreference) return true
  if (facts.missingSlots.some((s) => /hotel|lodging|accommod/i.test(s))) return true
  if (facts.lastIntent && /hotel|lodging|accommod/i.test(facts.lastIntent)) return true
  const signals = facts.softSignals ?? {}
  if (signals.lodgingFocus === true || signals.compareMode === 'lodging' || signals.compareMode === 'hotels') {
    return true
  }
  if (typeof signals.focus === 'string' && /hotel|lodging|accommod/i.test(signals.focus)) return true
  if (facts.optionHints?.some((h) => /hotel|فندق|إقامة|lodging/i.test(h))) return true
  return false
}

function bookingFocus(facts: {
  plan?: TravelFacts['plan']
  lastIntent?: string
  softSignals?: Record<string, unknown>
  phase?: string
}): boolean {
  if (facts.lastIntent && BOOKING_INTENTS.has(facts.lastIntent)) return true
  if (facts.phase && /book|checkout|payment/i.test(facts.phase)) return true
  const signals = facts.softSignals ?? {}
  const intent = signals.bookingIntent
  if (intent === 'book_now' || intent === 'confirm' || intent === 'checkout') return true
  if (signals.readyToBook === true) return true
  return false
}

/**
 * Derive the executive Current Goal from assembled travel facts.
 * Priority: Finalize booking → Confirm itinerary → Compare hotels →
 * Recommend flights → Collect destination.
 */
export function deriveExecutiveCurrentGoal(
  facts: Pick<
    TravelFacts,
    'known' | 'missingSlots' | 'plan' | 'objective' | 'lastIntent' | 'softSignals' | 'optionHints' | 'phase'
  >,
): ExecutiveCurrentGoal {
  const hasDestination = destinationKnown(facts.known)
  const hasPlan = Boolean(facts.plan)
  const hotels = lodgingFocus(facts)

  if (bookingFocus(facts)) {
    return 'Finalize booking'
  }

  if (
    hasPlan
    || facts.objective === 'present_plan'
    || facts.objective === 'acknowledge_save'
    || facts.objective === 'acknowledge_edit'
  ) {
    return 'Confirm itinerary'
  }

  if (!hasDestination) {
    return 'Collect destination'
  }

  if (hotels) {
    return 'Compare hotels'
  }

  // Destination known — lead with flights / routing (even while timing/budget fill in).
  return 'Recommend flights'
}
