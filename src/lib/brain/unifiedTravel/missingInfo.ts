/**
 * Sprint 31 — Detect missing planning fields and build minimal follow-ups.
 */

import type { UnifiedFollowUpQuestion, UnifiedTravelPlannerContext } from './types'

const CORE_FIELDS = [
  'destination',
  'origin',
  'travelDates',
  'travelers',
] as const

type CoreField = (typeof CORE_FIELDS)[number]

export function detectMissingUnifiedFields(
  ctx: UnifiedTravelPlannerContext,
): string[] {
  const missing: string[] = []
  if (!ctx.destination) missing.push('destination')
  if (!ctx.origin) missing.push('origin')
  if (!ctx.startDate && !ctx.endDate && ctx.nights <= 0) missing.push('travelDates')
  if (ctx.adults < 1) missing.push('travelers')
  return missing
}

export function buildUnifiedFollowUps(
  missing: string[],
  locale: 'ar' | 'en' = 'en',
): UnifiedFollowUpQuestion[] {
  // Ask at most one core follow-up (never passport / nationality).
  const first = missing.find((f): f is CoreField =>
    (CORE_FIELDS as readonly string[]).includes(f),
  )
  if (!first) return []

  return [
    {
      field: first,
      required: true,
      question: questionFor(first, locale),
    },
  ]
}

function questionFor(field: CoreField, locale: 'ar' | 'en'): string {
  if (locale === 'ar') {
    switch (field) {
      case 'destination':
        return 'إلى أين تود السفر؟'
      case 'origin':
        return 'من أي مدينة ستسافر؟'
      case 'travelDates':
        return 'ما تواريخ السفر أو مدة الإقامة؟'
      case 'travelers':
        return 'كم عدد المسافرين؟'
    }
  }
  switch (field) {
    case 'destination':
      return 'Where would you like to go?'
    case 'origin':
      return 'Which city are you departing from?'
    case 'travelDates':
      return 'What are your travel dates or trip length?'
    case 'travelers':
      return 'How many travelers?'
  }
}
