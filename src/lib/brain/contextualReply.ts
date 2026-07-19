import type { BrainLocale, BrainMemorySlot, ConversationMemory } from './types'
import { nextFieldToAsk } from './missingInformationDetector'

const FIELD_PROMPTS: Record<BrainMemorySlot, { ar: string; en: string }> = {
  destination: {
    ar: 'إلى أين تود السفر؟',
    en: 'Where would you like to go?',
  },
  origin: {
    ar: 'من أي مدينة ستغادر؟',
    en: 'Which city are you departing from?',
  },
  budget: {
    ar: 'ما هي ميزانيتك التقريبية؟',
    en: 'What is your approximate budget?',
  },
  travelDates: {
    ar: 'متى تود السفر؟',
    en: 'When do you want to travel?',
  },
  travelers: {
    ar: 'كم عدد المسافرين؟',
    en: 'How many travelers?',
  },
  cabinClass: {
    ar: 'ما درجة السفر المفضلة؟',
    en: 'Which cabin class do you prefer?',
  },
  airlinePreferences: {
    ar: 'هل لديك تفضيل لشركة طيران؟',
    en: 'Any airline preference?',
  },
  hotelPreferences: {
    ar: 'ما نوع الإقامة التي تفضلها؟',
    en: 'What kind of stay do you prefer?',
  },
  hotelRequirement: {
    ar: 'هل تحتاج فندقاً أيضاً؟',
    en: 'Do you also need a hotel?',
  },
  activities: {
    ar: 'ما الأنشطة التي تهمك؟',
    en: 'Which activities interest you?',
  },
  visaRequirements: {
    ar: 'هل تحتاج مساعدة بشأن التأشيرة؟',
    en: 'Do you need help with visa requirements?',
  },
  conversationLanguage: {
    ar: 'بأي لغة تفضل المتابعة؟',
    en: 'Which language should we continue in?',
  },
  currency: {
    ar: 'بأي عملة تفضل الميزانية؟',
    en: 'Which currency for your budget?',
  },
}

/**
 * Sprint 21 — one short contextual follow-up.
 * Remembers known slots; never re-asks them; asks exactly one missing field.
 */
export function buildContextualFollowUp(input: {
  memory: ConversationMemory
  missingFields: BrainMemorySlot[]
  locale: BrainLocale
}): string | null {
  const ask = nextFieldToAsk(input.missingFields)
  if (!ask) return null

  const question =
    input.locale === 'ar' ? FIELD_PROMPTS[ask].ar : FIELD_PROMPTS[ask].en
  const known = summarizeKnown(input.memory, input.locale)

  if (!known) return question

  if (input.locale === 'ar') {
    return `حسناً — ${known}. ${question}`
  }
  return `Got it — ${known}. ${question}`
}

export function promptForField(
  field: BrainMemorySlot,
  locale: BrainLocale,
): string {
  return locale === 'ar' ? FIELD_PROMPTS[field].ar : FIELD_PROMPTS[field].en
}

function summarizeKnown(memory: ConversationMemory, locale: BrainLocale): string {
  const parts: string[] = []

  if (memory.destination) {
    parts.push(
      locale === 'ar' ? `الوجهة ${memory.destination}` : `${memory.destination}`,
    )
  }
  if (memory.origin) {
    parts.push(
      locale === 'ar' ? `المغادرة من ${memory.origin}` : `from ${memory.origin}`,
    )
  }
  if (memory.travelers.count != null || memory.travelers.adults != null) {
    const adults = memory.travelers.adults ?? memory.travelers.count ?? 0
    const children = memory.travelers.children ?? 0
    const infants = memory.travelers.infants ?? 0
    if (locale === 'ar') {
      let line = `${adults} بالغ`
      if (children) line += ` و${children} طفل`
      if (infants) line += ` و${infants} رضيع`
      parts.push(line)
    } else {
      const bits: string[] = []
      if (adults) bits.push(`${adults} adult${adults === 1 ? '' : 's'}`)
      if (children) bits.push(`${children} child${children === 1 ? '' : 'ren'}`)
      if (infants) bits.push(`${infants} infant${infants === 1 ? '' : 's'}`)
      parts.push(bits.join(', ') || `${memory.travelers.count} travelers`)
    }
  }
  if (memory.budget.amount != null) {
    const cur = memory.budget.currency ?? memory.currency ?? 'SAR'
    parts.push(
      locale === 'ar'
        ? `ميزانية ${memory.budget.amount} ${cur}`
        : `budget ${memory.budget.amount} ${cur}`,
    )
  } else if (memory.budget.flexible) {
    parts.push(locale === 'ar' ? 'ميزانية مرنة' : 'flexible budget')
  }
  if (memory.airlinePreferences.length) {
    parts.push(
      locale === 'ar'
        ? `تفضيل ${memory.airlinePreferences.join(' / ')}`
        : `${memory.airlinePreferences.join(' / ')} preferred`,
    )
  }
  if (memory.hotelPreferences.length) {
    parts.push(
      locale === 'ar'
        ? `إقامة ${memory.hotelPreferences.join(' / ')}`
        : `${memory.hotelPreferences.join(' / ')} stay`,
    )
  }
  if (memory.cabinClass) {
    parts.push(
      locale === 'ar' ? `درجة ${memory.cabinClass}` : `${memory.cabinClass} cabin`,
    )
  }
  if (memory.travelDates.durationDays != null) {
    parts.push(
      locale === 'ar'
        ? `${memory.travelDates.durationDays} أيام`
        : `${memory.travelDates.durationDays} days`,
    )
  } else if (memory.travelDates.flexible) {
    parts.push(locale === 'ar' ? 'تواريخ مرنة' : 'flexible dates')
  }

  return parts.join(locale === 'ar' ? '، ' : ', ')
}
