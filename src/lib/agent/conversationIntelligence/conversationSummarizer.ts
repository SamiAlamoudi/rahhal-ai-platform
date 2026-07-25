import type { ConsultantLocale, ConversationSummary, LiveTravelMemory } from './types'

function travelerLine(memory: LiveTravelMemory, locale: ConsultantLocale): string | null {
  const { adults, children, infants, total } = memory.travelers
  if (total == null && adults == null) return null
  if (locale === 'ar') {
    const parts: string[] = []
    if (adults != null) parts.push(`${adults} بالغ`)
    if (children != null && children > 0) parts.push(`${children} طفل`)
    if (infants != null && infants > 0) parts.push(`${infants} رضيع`)
    return parts.length ? parts.join(' · ') : `${total} مسافر`
  }
  const parts: string[] = []
  if (adults != null) parts.push(`${adults} adult${adults === 1 ? '' : 's'}`)
  if (children != null && children > 0) parts.push(`${children} child${children === 1 ? '' : 'ren'}`)
  if (infants != null && infants > 0) parts.push(`${infants} infant${infants === 1 ? '' : 's'}`)
  return parts.length ? parts.join(' · ') : `${total} travelers`
}

/** Smart confirmation summary — not an interview checklist. */
export function summarizeConversation(
  memory: LiveTravelMemory,
  _locale: ConsultantLocale = 'ar',
): ConversationSummary {
  void _locale
  const bulletsAr: string[] = []
  const bulletsEn: string[] = []

  if (memory.destination) {
    bulletsAr.push(memory.destination)
    bulletsEn.push(memory.destination)
  }
  if (memory.monthHint) {
    bulletsAr.push(memory.monthHint)
    bulletsEn.push(memory.monthHint)
  } else if (memory.flexibleDates) {
    bulletsAr.push('تواريخ مرنة')
    bulletsEn.push('Flexible dates')
  }
  const travelersAr = travelerLine(memory, 'ar')
  const travelersEn = travelerLine(memory, 'en')
  if (travelersAr) bulletsAr.push(travelersAr)
  if (travelersEn) bulletsEn.push(travelersEn)

  if (memory.budgetAmount != null) {
    const cur = memory.currency ?? 'SAR'
    bulletsAr.push(`حوالي ${memory.budgetAmount.toLocaleString('en-US')} ${cur}`)
    bulletsEn.push(`Around ${memory.budgetAmount.toLocaleString('en-US')} ${cur}`)
  }
  if (memory.hotelPreferences.length) {
    bulletsAr.push(memory.hotelPreferences.join(' · '))
    bulletsEn.push(memory.hotelPreferences.join(' · '))
  }
  if (memory.purpose) {
    const purposeAr: Record<string, string> = {
      business: 'رحلة عمل',
      leisure: 'سياحة',
      family: 'عائلة',
      honeymoon: 'شهر عسل',
      adventure: 'مغامرة',
      luxury: 'فاخر',
    }
    bulletsAr.push(purposeAr[memory.purpose] ?? memory.purpose)
    bulletsEn.push(memory.purpose)
  }

  return {
    bulletsAr,
    bulletsEn,
    confirmPromptAr: 'هل فهمت طلبك بشكل صحيح؟',
    confirmPromptEn: 'Did I understand that correctly?',
  }
}

export function formatSummaryForConsultant(
  summary: ConversationSummary,
  locale: ConsultantLocale,
): string {
  const bullets = locale === 'ar' ? summary.bulletsAr : summary.bulletsEn
  if (bullets.length === 0) return ''
  const heading =
    locale === 'ar' ? 'مما فهمتُ حتى الآن:' : 'From what I understood:'
  const prompt = locale === 'ar' ? summary.confirmPromptAr : summary.confirmPromptEn
  return `${heading}\n${bullets.map((b) => `• ${b}`).join('\n')}\n\n${prompt}`
}

export const ConversationSummarizer = {
  summarize: summarizeConversation,
  format: formatSummaryForConsultant,
}
