import type { ConsultantLocale, IntelligentQuestion, LiveTravelMemory } from './types'

/**
 * Only ask outcome-changing questions — never interview mode.
 */
export function planIntelligentQuestions(
  memory: LiveTravelMemory,
  locale: ConsultantLocale = 'ar',
): IntelligentQuestion[] {
  void locale
  const questions: IntelligentQuestion[] = []

  // Destination completely unknown → one soft discovery question (not "where?")
  if (!memory.destination && memory.cities.length === 0) {
    questions.push({
      id: 'vibe',
      priority: 10,
      textAr: 'أتحب أجواء مدينة حيوية، ولا طبيعة هادئة؟',
      textEn: 'Would you rather a lively city vibe, or somewhere quieter in nature?',
      whyAr: 'يغيّر نطاق الوجهات المقترحة',
      whyEn: 'Changes which destinations we shortlist',
    })
  }

  // Dates unknown and not flexible
  if (!memory.monthHint && !memory.startDate && memory.flexibleDates !== true) {
    questions.push({
      id: 'season_window',
      priority: 20,
      textAr: 'هل لديك شهر تقريبي، أم تفضّل أن أقترح أفضل موسم؟',
      textEn: 'Do you have an approximate month, or should I suggest the best season?',
      whyAr: 'يؤثر على الطقس والأسعار',
      whyEn: 'Affects weather and pricing',
    })
  }

  // Flights: stopover tradeoff only if flight intent-ish and preference unknown
  if (memory.destination && memory.stopoverPreference == null) {
    questions.push({
      id: 'stops_tradeoff',
      priority: 30,
      textAr: 'أتفضّل رحلات مباشرة، أم لا مانع من توقف واحد إن وفّر مبلغاً جيداً؟',
      textEn: 'Do you prefer direct flights, or is one stop fine if it saves meaningfully?',
      whyAr: 'يغيّر ترتيب خيارات الطيران',
      whyEn: 'Changes flight ranking',
    })
  }

  // Hotel vibe only if destination known and no hotel prefs
  if (memory.destination && memory.hotelPreferences.length === 0) {
    questions.push({
      id: 'hotel_vibe',
      priority: 40,
      textAr: 'للفندق: هل تهمّك الهدوء أكثر أم الموقع المركزي؟',
      textEn: 'For hotels: do you value quiet more, or a central location?',
      whyAr: 'يغيّر نوع الإقامة المقترحة',
      whyEn: 'Changes stay shortlist',
    })
  }

  // Budget only if completely absent and destination known
  if (memory.destination && memory.budgetAmount == null && memory.flexibleDates !== true) {
    // still avoid classic "budget?" — ask tradeoff
    questions.push({
      id: 'value_tradeoff',
      priority: 50,
      textAr: 'أهم شيء لك: أقل سعر ممكن، أم راحة أعلى ضمن ميزانية معقولة؟',
      textEn: 'What matters more: the lowest fare, or more comfort within a sensible budget?',
      whyAr: 'يحدد أسلوب الميزانية',
      whyEn: 'Sets budget style',
    })
  }

  // Conversation-first: at most one intelligent question per turn.
  return questions.sort((a, b) => a.priority - b.priority).slice(0, 1)
}

/** Fields that are OK to leave unknown — never force interview. */
export function filterInterviewMissingFields(missing: string[]): string[] {
  const banned = new Set([
    'destination',
    'startDate',
    'endDate',
    'travelers',
    'budgetAmount',
    'hotelPreference',
  ])
  // When intelligence is ON we prefer consultant questions over raw missing slots.
  return missing.filter((field) => !banned.has(field))
}

export const QuestionPlanner = {
  plan: planIntelligentQuestions,
  filterInterviewMissingFields,
}
