/**
 * Sprint 28 — minimum follow-up questions from missing preference slots.
 */

import type { BrainLocale, TravelIntent } from '../types'
import type { EnrichedConversationMemory, ExtendedMemorySlot } from './types'

/** Preference slots that improve personalization but are never blocking alone. */
const PREFERENCE_SLOTS: ExtendedMemorySlot[] = [
  'cabinClass',
  'airlinePreferences',
  'hotelPreferences',
  'seatPreferences',
  'mealPreferences',
  'accessibilityRequirements',
  'loyaltyPrograms',
  'familyMembers',
]

const CORE_BY_INTENT: Partial<Record<TravelIntent, ExtendedMemorySlot[]>> = {
  SearchFlights: ['destination', 'origin', 'travelDates', 'travelers'],
  SearchHotels: ['destination', 'travelDates', 'travelers'],
  SearchPackages: ['destination', 'origin', 'travelDates', 'travelers', 'budget'],
  AskRecommendation: ['destination'],
  BudgetPlanning: ['destination', 'budget'],
  VisaQuestion: ['destination'],
  GeneralConversation: ['destination'],
}

function isFilled(
  memory: EnrichedConversationMemory,
  slot: ExtendedMemorySlot,
): boolean {
  switch (slot) {
    case 'destination':
      return Boolean(memory.destination || memory.destinations.length > 0)
    case 'origin':
      return Boolean(memory.origin)
    case 'budget':
      return memory.budget.amount != null || memory.budget.flexible
    case 'travelDates':
      return (
        memory.travelDates.durationDays != null ||
        Boolean(memory.travelDates.startDate) ||
        memory.travelDates.flexible
      )
    case 'travelers':
      return (
        memory.travelers.count != null ||
        memory.travelers.adults != null ||
        (memory.travelers.children ?? 0) + (memory.travelers.infants ?? 0) > 0
      )
    case 'cabinClass':
      return memory.cabinClass != null
    case 'airlinePreferences':
      return memory.airlinePreferences.length > 0
    case 'hotelPreferences':
      return memory.hotelPreferences.length > 0
    case 'hotelRequirement':
      return memory.hotelRequirement !== null
    case 'activities':
      return memory.activities.length > 0
    case 'visaRequirements':
      return memory.visaRequirements != null || memory.visaStatus != null
    case 'conversationLanguage':
      return true
    case 'currency':
      return memory.currency != null || memory.budget.currency != null
    case 'familyMembers':
      return memory.familyMembers.length > 0
    case 'passportNationality':
      return (
        memory.passportNationality.explicitlyProvided &&
        Boolean(memory.passportNationality.nationality)
      )
    case 'seatPreferences':
      return memory.seatPreferences.length > 0
    case 'mealPreferences':
      return memory.mealPreferences.length > 0
    case 'accessibilityRequirements':
      return memory.accessibilityRequirements.length > 0
    case 'loyaltyPrograms':
      return memory.loyaltyPrograms.length > 0
    default:
      return false
  }
}

/**
 * Detect missing information — core slots first, then at most one preference prompt.
 * Never asks for passport/nationality proactively (privacy).
 */
export function detectMissingPreferenceSlots(input: {
  memory: EnrichedConversationMemory
  intent: TravelIntent
  /** Max questions to surface (default 1). */
  maxQuestions?: number
}): ExtendedMemorySlot[] {
  const max = input.maxQuestions ?? 1
  const required = CORE_BY_INTENT[input.intent] ?? ['destination']
  const missing: ExtendedMemorySlot[] = []

  for (const slot of required) {
    if (isFilled(input.memory, slot)) continue
    // Never re-ask core slots already asked on base ConversationMemory.
    if (
      (input.memory.askedFields as string[]).includes(slot) &&
      slot !== 'familyMembers'
    ) {
      continue
    }
    missing.push(slot)
  }

  if (missing.length >= max) return missing.slice(0, max)

  // Optional preference enrichment — only when core is complete.
  if (missing.length === 0) {
    for (const slot of PREFERENCE_SLOTS) {
      if (isFilled(input.memory, slot)) continue
      missing.push(slot)
      break
    }
  }

  return missing.slice(0, max)
}

export function buildFollowUpQuestions(input: {
  missingSlots: ExtendedMemorySlot[]
  locale?: BrainLocale
  /** Hard cap — minimum questions only. */
  max?: number
}): string[] {
  const locale = input.locale ?? 'ar'
  const max = input.max ?? 1
  const questions: string[] = []
  for (const slot of input.missingSlots.slice(0, max)) {
    // Never proactively ask for passport/nationality.
    if (slot === 'passportNationality') continue
    questions.push(promptForExtendedSlot(slot, locale))
  }
  return questions
}

export function promptForExtendedSlot(
  slot: ExtendedMemorySlot,
  locale: BrainLocale,
): string {
  if (locale === 'en') {
    switch (slot) {
      case 'destination':
        return 'Where would you like to go?'
      case 'origin':
        return 'Where are you flying from?'
      case 'travelDates':
        return 'Which dates work for you?'
      case 'travelers':
        return 'How many travelers?'
      case 'budget':
        return 'What budget range should I use?'
      case 'cabinClass':
        return 'Any cabin class preference?'
      case 'airlinePreferences':
        return 'Any preferred airlines?'
      case 'hotelPreferences':
        return 'Any preferred hotel brands?'
      case 'hotelRequirement':
        return 'Do you need a hotel as well?'
      case 'seatPreferences':
        return 'Window or aisle seat?'
      case 'mealPreferences':
        return 'Any meal preferences (halal, vegetarian, …)?'
      case 'accessibilityRequirements':
        return 'Any accessibility needs I should plan for?'
      case 'loyaltyPrograms':
        return 'Any airline or hotel loyalty programs to apply?'
      case 'familyMembers':
        return 'Who is traveling with you?'
      case 'visaRequirements':
        return 'Do you already have a visa, or should I check requirements?'
      case 'currency':
        return 'Which currency should I use for prices?'
      case 'activities':
        return 'Anything you especially want to do there?'
      default:
        return 'What else should I know for this trip?'
    }
  }

  switch (slot) {
    case 'destination':
      return 'إلى أين تود السفر؟'
    case 'origin':
      return 'من أين ستقلع؟'
    case 'travelDates':
      return 'ما التواريخ المناسبة؟'
    case 'travelers':
      return 'كم عدد المسافرين؟'
    case 'budget':
      return 'ما نطاق الميزانية؟'
    case 'cabinClass':
      return 'هل تفضل درجة معينة؟'
    case 'airlinePreferences':
      return 'هل لديك شركة طيران مفضلة؟'
    case 'hotelPreferences':
      return 'هل لديك علامة فندقية مفضلة؟'
    case 'hotelRequirement':
      return 'هل تحتاج فندقاً أيضاً؟'
    case 'seatPreferences':
      return 'هل تفضل مقعد نافذة أم ممر؟'
    case 'mealPreferences':
      return 'هل لديك تفضيل وجبات (حلال، نباتي، …)؟'
    case 'accessibilityRequirements':
      return 'هل هناك احتياجات إمكانية وصول يجب مراعاتها؟'
    case 'loyaltyPrograms':
      return 'هل لديك برنامج ولاء للطيران أو الفنادق؟'
    case 'familyMembers':
      return 'من يسافر معك؟'
    case 'visaRequirements':
      return 'هل لديك تأشيرة، أم أتحقق من المتطلبات؟'
    case 'currency':
      return 'بأي عملة أعرض الأسعار؟'
    case 'activities':
      return 'ما الذي تود فعله هناك؟'
    default:
      return 'ما الذي يجب أن أعرفه أيضاً عن هذه الرحلة؟'
  }
}
