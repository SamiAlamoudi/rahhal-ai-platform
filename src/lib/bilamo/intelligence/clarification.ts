/**
 * Minimum follow-up policy — one hard slot at a time.
 * Budget is never asked. Never re-ask slots already asked or filled.
 */

import {
  hasApproximateTravelDates,
  missingClarificationFields,
} from '../../agent/clarification'
import type { TripRequirements } from '../../agent/types'
import type { BilamoHardSlot } from './types'
import type { BilamoConsultantMemory } from './types'

const FIELD_TO_SLOT: Record<string, BilamoHardSlot> = {
  destination: 'destination',
  durationDays: 'dates',
  travelers: 'travelers',
}

export function nextMinimumQuestion(input: {
  requirements: TripRequirements
  askedSlots: BilamoHardSlot[]
}): BilamoHardSlot | null {
  const missing = missingClarificationFields(input.requirements, { smart: true })
  for (const field of missing) {
    const slot = FIELD_TO_SLOT[field]
    if (!slot) continue
    if (input.askedSlots.includes(slot)) continue
    if (slot === 'dates' && hasApproximateTravelDates(input.requirements)) continue
    return slot
  }
  return null
}

export function canSearch(requirements: TripRequirements): boolean {
  return nextMinimumQuestion({ requirements, askedSlots: [] }) == null
}

export function clarificationPrompt(
  slot: BilamoHardSlot,
  requirements: TripRequirements,
  locale: 'ar' | 'en',
): { displayText: string; spokenText: string } {
  const dest = requirements.destination || requirements.destinations[0] || null

  if (slot === 'destination') {
    const displayText = locale === 'ar'
      ? 'بكل سرور. إلى أين تتخيّل الرحلة؟'
      : 'Of course. Where are you imagining this trip?'
    return { displayText, spokenText: displayText }
  }

  if (slot === 'dates') {
    const displayText = locale === 'ar'
      ? (dest
        ? `ممتاز — ${dest}. متى تقريباً، وكم يوم؟`
        : 'متى تقريباً تتخيّل السفر، وكم يوم؟')
      : (dest
        ? `Wonderful — ${dest}. When are you thinking, and roughly how many days?`
        : 'When are you thinking of traveling, and roughly how many days?')
    const spokenText = locale === 'ar'
      ? (dest ? `ممتاز. متى تقريباً لـ ${dest}؟` : 'متى تقريباً تتخيّل السفر؟')
      : (dest ? `Wonderful. When roughly for ${dest}?` : 'When roughly are you thinking?')
    return { displayText, spokenText }
  }

  // travelers
  const displayText = locale === 'ar'
    ? (dest
      ? `حسناً — ${dest}. تسافر لوحدك، أم مع أحد؟`
      : 'تسافر لوحدك، أم مع أحد؟')
    : (dest
      ? `Understood — ${dest}. Traveling solo, or with someone?`
      : 'Are you traveling solo, or with someone?')
  const spokenText = locale === 'ar'
    ? 'تسافر لوحدك، أم مع أحد؟'
    : 'Solo, or with someone?'
  return { displayText, spokenText }
}

export function acknowledgeAndAsk(
  memory: BilamoConsultantMemory,
  slot: BilamoHardSlot,
  requirements: TripRequirements,
): { displayText: string; spokenText: string } {
  const locale = memory.locale === 'en' ? 'en' : 'ar'
  return clarificationPrompt(slot, requirements, locale)
}
