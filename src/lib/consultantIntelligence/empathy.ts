/**
 * Reflect traveler intent before advising.
 */

import type { ConsultantLocale, EmpathyCue } from './types'

export function detectEmpathyCue(input: {
  userText: string
  tripPurpose?: string | null
  travelerType?: string | null
  budgetAmount?: number | null
  budgetStyle?: string | null
  interests?: string[]
  softMustHaves?: string[]
  softDealBreakers?: string[]
}): EmpathyCue {
  const blob = [
    input.userText,
    input.tripPurpose ?? '',
    input.travelerType ?? '',
    ...(input.interests ?? []),
    ...(input.softMustHaves ?? []),
    ...(input.softDealBreakers ?? []),
  ].join(' ')

  if (/شهر\s*عسل|honeymoon|romantic/i.test(blob) || input.tripPurpose === 'honeymoon') {
    return 'honeymoon'
  }
  if (/عائلت|family|أطفال|kids/i.test(blob) || input.travelerType === 'family') {
    return 'family'
  }
  if (
    /ميزانية\s*محدودة|budget\s*tight|low\s*budget|أرخص|value/i.test(blob)
    || input.budgetStyle === 'budget'
    || (input.budgetAmount != null && input.budgetAmount > 0 && input.budgetAmount <= 5000)
  ) {
    return 'budget_tight'
  }
  if (/crowds|ازدحام|زحمة|quiet|هدوء/i.test(blob)) return 'avoid_crowds'
  if (/بحر|شاطئ|beach/i.test(blob)) return 'beach'
  if (/ثقاف|سوق|souk|culture/i.test(blob)) return 'culture'
  return null
}

export function empathyLine(cue: EmpathyCue, locale: ConsultantLocale): string | null {
  if (!cue) return null
  const ar = locale === 'ar'
  switch (cue) {
    case 'honeymoon':
      return ar
        ? 'مبروك مقدماً — خلّينا نصمّم رحلة بهدوء وخصوصية تليق بهذه المناسبة.'
        : 'Congratulations in advance — let’s shape a calm, private trip worthy of the occasion.'
    case 'family':
      return ar
        ? 'دعنا نجعلها مريحة للأطفال — إيقاع أخف وإقامة أسهل للتنقل.'
        : 'Let’s keep it comfortable for the children — a gentler pace and an easy base.'
    case 'budget_tight':
      return ar
        ? 'سنركز على أفضل قيمة مقابل السعر، من دون التنازل عن جودة التجربة.'
        : 'We’ll focus on the best value for money — without watering down the experience.'
    case 'avoid_crowds':
      return ar
        ? 'مفهوم — سأتجنب الزحام وأميل للأحياء والفنادق الأهدأ.'
        : 'Understood — I’ll steer clear of crowds and lean toward quieter areas and hotels.'
    case 'beach':
      return ar
        ? 'إذا كان هدفك الاسترخاء على البحر، سأضيّق الخيارات على هذا الإحساس.'
        : 'If the goal is beach recovery, I’ll narrow options around that feeling.'
    case 'culture':
      return ar
        ? 'الأسواق والتجارب المحلية تضيف طعماً حقيقياً للرحلة — سأبني عليها.'
        : 'Souks and local experiences give the trip real character — I’ll build on that.'
    default:
      return null
  }
}
