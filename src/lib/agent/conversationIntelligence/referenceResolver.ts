import type { LiveTravelMemory, ResolvedReference } from './types'

/**
 * Resolve conversational references using live memory + recent turns.
 */
export function resolveReferences(
  userText: string,
  memory: LiveTravelMemory,
  recentTexts: string[] = [],
): ResolvedReference[] {
  const text = userText.trim().toLowerCase()
  const resolved: ResolvedReference[] = []
  const recent = recentTexts.join(' \n ').toLowerCase()

  const push = (phrase: string, resolvesTo: string, kind: ResolvedReference['kind']) => {
    if (!resolvesTo) return
    if (resolved.some((r) => r.phrase === phrase && r.resolvesTo === resolvesTo)) return
    resolved.push({ phrase, resolvesTo, kind })
  }

  if (/\bthere\b|هناك|لهناك|there\b/.test(text) && memory.destination) {
    push('there', memory.destination, 'destination')
  }
  if (/\bsame hotel\b|نفس الفندق|نفس الإقامة/.test(text)) {
    const hotel = memory.hotelPreferences[0] ?? 'previous hotel preference'
    push('same hotel', hotel, 'hotel')
  }
  if (/\bsame budget\b|نفس الميزانية|نفس السعر/.test(text) && memory.budgetAmount != null) {
    push(
      'same budget',
      `${memory.budgetAmount} ${memory.currency ?? 'SAR'}`,
      'budget',
    )
  }
  if (/\bthat airline\b|نفس الطيران|تلك الشركة|نفس الخط/.test(text) && memory.airlines[0]) {
    push('that airline', memory.airlines[0], 'airline')
  }
  if (/\blike paris\b|مثل باريس|زي باريس/.test(text)) {
    push('like Paris', 'Paris-like destination style', 'destination')
  }
  if (/\bnext week\b|الأسبوع القادم|الاسبوع القادم/.test(text)) {
    push('next week', 'relative:next_week', 'date')
  }
  if (/\bhe\b|\bshe\b|\bit\b|هو\b|هي\b/.test(text) && memory.travelers.adults != null) {
    push('pronoun', `${memory.travelers.total ?? memory.travelers.adults} travelers`, 'person')
  }

  // Recover destination from recent turns if user says "same place"
  if (/\bsame place\b|نفس المكان|نفس الوجهة/.test(text)) {
    const fromRecent = /(tokyo|dubai|paris|istanbul|طوكيو|دبي|باريس|إسطنبول)/i.exec(recent)
    if (memory.destination) push('same place', memory.destination, 'destination')
    else if (fromRecent?.[1]) push('same place', fromRecent[1], 'destination')
  }

  return resolved
}

export const ReferenceResolver = {
  resolve: resolveReferences,
}
