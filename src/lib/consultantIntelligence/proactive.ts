/**
 * Ahead-of-the-traveler advice — never inventory dumps.
 */

import type { ConsultantLocale } from './types'

export function buildProactiveConsultantTips(input: {
  locale: ConsultantLocale
  destination?: string | null
  destinationCity?: string | null
  startDate?: string | null
  durationDays?: number | null
  travelerType?: string | null
  tripPurpose?: string | null
  dealBreakers?: string[]
  mustHaves?: string[]
}): string[] {
  const ar = input.locale === 'ar'
  const tips: string[] = []
  const dest = (input.destinationCity || input.destination || '').toLowerCase()
  const month = input.startDate ? Number(input.startDate.slice(5, 7)) : null
  const avoidsCrowds = (input.dealBreakers ?? []).some((d) => /crowd|peak/i.test(d))

  if (month === 8 || (month != null && month >= 7 && month <= 8)) {
    tips.push(ar
      ? 'أغسطس غالباً أكثر ازدحاماً وحرارة — إن أمكن احجز الإقامة مبكراً، واترك هامشاً للتنقل.'
      : 'August is usually busier and hotter — book stays early when you can, and leave buffer for getting around.')
  }

  if (/agadir|أكادير/.test(dest)) {
    tips.push(ar
      ? 'أكادير أنسب للاستجمام؛ أفضل حي للإقامة غالباً قرب الشاطئ أو تيمولاي حسب ميزانيتك.'
      : 'Agadir suits recovery travel; the best base is usually near the beach or Tilmlaï depending on budget.')
  } else if (/marrakech|مراكش/.test(dest)) {
    tips.push(ar
      ? 'في مراكش، تجنّب قلب السوق إذا كنت تكره الزحام ليلاً — الأحياء الهادئة حول النخيل أو الأكدال أريح.'
      : 'In Marrakech, skip the medina core at night if you dislike crowds — quieter pockets around Palmeraie or Guéliz are kinder.')
  } else if (/morocco|المغرب/.test(dest) && !input.destinationCity) {
    tips.push(ar
      ? 'من واقع تجربتي: أغادير أهدأ صيفاً وغالباً أفضل قيمة للمنتجعات، بينما مراكش أغنى ثقافياً وأكثف حركة.'
      : 'From experience: Agadir is calmer in summer and usually better resort value, while Marrakech is richer culturally and busier.')
  }

  if (input.travelerType === 'couple' || input.tripPurpose === 'honeymoon') {
    tips.push(ar
      ? 'هذا النمط يناسب الأزواج — سأفضّل فنادق بهدوء وخصوصية أكثر من مواقع السياحة الجماعية.'
      : 'This profile suits couples — I’ll prefer quieter, more private hotels over mass-tourism blocks.')
  }

  if (input.travelerType === 'family') {
    tips.push(ar
      ? 'للعائلة أنصح بالاحتفاظ بيوم إضافي خفيف في آخر الرحلة — الأطفال يتعبون من الجدول المزدحم.'
      : 'For families, keep one lighter buffer day at the end — packed schedules wear children out.')
  }

  if (avoidsCrowds) {
    tips.push(ar
      ? 'سأتجنب ذروة الموسم والمناطق الصاخبة، وأميل لفنادق هادئة بعيداً عن مسارات الجولات الكثيفة.'
      : 'I’ll avoid peak crush zones and lean toward quiet hotels off the heavy tour routes.')
  }

  if ((input.mustHaves ?? []).includes('beach') && /morocco|المغرب|agadir|أكادير/.test(dest)) {
    tips.push(ar
      ? 'لو كنت مكانك لاخترت قاعدة شاطئية أولاً، ثم زيارة ثقافية قصيرة إن بقي وقت.'
      : 'If I were you, I’d anchor on a beach base first, then add a short cultural side trip if time remains.')
  }

  // Cap — never dump.
  return tips.slice(0, 2)
}
