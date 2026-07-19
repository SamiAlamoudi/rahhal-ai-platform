import type { BrainLocale } from '../types'
import type { ClarificationPlan, PlanningField, PlanningSession } from './types'
import { nextPlanningFieldToAsk } from './missingDetector'

const PROMPTS: Record<PlanningField, { ar: string; en: string }> = {
  destination: {
    ar: 'إلى أين تود السفر؟',
    en: 'Where would you like to go?',
  },
  departureCity: {
    ar: 'من أي مدينة ستغادر؟',
    en: 'Which city are you departing from?',
  },
  travelDates: {
    ar: 'متى تود السفر؟',
    en: 'When do you want to travel?',
  },
  travelerCount: {
    ar: 'كم عدد المسافرين؟',
    en: 'How many travelers?',
  },
  cabinClass: {
    ar: 'ما درجة السفر المفضلة؟',
    en: 'Which cabin class do you prefer?',
  },
  hotelPreferences: {
    ar: 'ما نوع الإقامة التي تفضلها؟',
    en: 'What kind of stay do you prefer?',
  },
  roomRequirements: {
    ar: 'ما متطلبات الغرف؟',
    en: 'Any room requirements?',
  },
  transportation: {
    ar: 'ما وسيلة التنقل المفضلة؟',
    en: 'Preferred transportation?',
  },
  activities: {
    ar: 'ما الأنشطة التي تهمك؟',
    en: 'Which activities interest you?',
  },
  budget: {
    ar: 'ما هي ميزانيتك التقريبية؟',
    en: 'What is your approximate budget?',
  },
  airlinePreferences: {
    ar: 'هل لديك تفضيل لشركة طيران؟',
    en: 'Any airline preference?',
  },
  notes: {
    ar: 'أي ملاحظات إضافية؟',
    en: 'Any additional notes?',
  },
}

/**
 * Generate the smallest possible clarification — exactly one question.
 * Acknowledges known session facts when helpful.
 */
export function buildClarificationPlan(input: {
  session: PlanningSession
  missing: PlanningField[]
}): ClarificationPlan {
  const field = nextPlanningFieldToAsk(input.missing)
  if (!field) {
    return {
      field: null,
      question: null,
      reason: 'none',
      singleQuestion: true,
    }
  }

  const locale: BrainLocale = input.session.locale
  const base = locale === 'ar' ? PROMPTS[field].ar : PROMPTS[field].en
  const known = summarizeKnown(input.session, locale)
  const question = known
    ? locale === 'ar'
      ? `حسناً — ${known}. ${base}`
      : `Got it — ${known}. ${base}`
    : base

  return {
    field,
    question,
    reason: 'missing_required',
    singleQuestion: true,
  }
}

function summarizeKnown(session: PlanningSession, locale: BrainLocale): string {
  const parts: string[] = []
  if (session.destination) {
    parts.push(locale === 'ar' ? `الوجهة ${session.destination}` : `${session.destination}`)
  }
  if (session.departureCity) {
    parts.push(
      locale === 'ar' ? `من ${session.departureCity}` : `from ${session.departureCity}`,
    )
  }
  if (session.travelerCount != null || session.adults != null) {
    const adults = session.adults ?? session.travelerCount ?? 0
    const children = session.children ?? 0
    if (locale === 'ar') {
      parts.push(`${adults} بالغ` + (children ? ` و${children} طفل` : ''))
    } else {
      parts.push(
        `${adults} adult${adults === 1 ? '' : 's'}` +
          (children ? `, ${children} child${children === 1 ? '' : 'ren'}` : ''),
      )
    }
  }
  if (session.budget.amount != null) {
    const cur = session.budget.currency ?? 'SAR'
    parts.push(
      locale === 'ar'
        ? `ميزانية ${session.budget.amount} ${cur}`
        : `budget ${session.budget.amount} ${cur}`,
    )
  }
  if (session.airlinePreferences.length) {
    parts.push(session.airlinePreferences.join(' / '))
  }
  if (session.hotelPreferences.length) {
    parts.push(session.hotelPreferences.join(' / '))
  }
  return parts.join(locale === 'ar' ? '، ' : ', ')
}
