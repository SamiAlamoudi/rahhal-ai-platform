/**
 * Sprint 85 — Question Generator.
 * Exactly ONE next question — highest-priority missing slot.
 */

import { QuestionPlanner } from '../planning/QuestionPlanner'
import type { TravelPlanSlotKey, TravelPlanSlots } from '../planning/types'
import type { ConversationQuestion } from './types'

const WHY: Record<TravelPlanSlotKey, { ar: string; en: string }> = {
  destination: {
    ar: 'أحتاج الوجهة لأبني خطة السفر الصحيحة.',
    en: 'I need the destination to build the right travel plan.',
  },
  dates: {
    ar: 'التواريخ تساعدني أقارن الخيارات المناسبة لوقتك.',
    en: 'Dates help me compare options that fit your schedule.',
  },
  origin: {
    ar: 'مدينة المغادرة ضرورية للبحث عن الرحلات.',
    en: 'Departure city is required to search flights.',
  },
  adults: {
    ar: 'عدد المسافرين يؤثر على التوفر والسعر.',
    en: 'Traveler count affects availability and price.',
  },
  children: {
    ar: 'معرفة عدد الأطفال يساعدني أختار خيارات مناسبة للعائلة.',
    en: 'Knowing children count helps me pick family-friendly options.',
  },
  budget: {
    ar: 'الميزانية توجّه الترشيحات بدون تجاوز حدودك.',
    en: 'Budget keeps recommendations within your limits.',
  },
  cabin: {
    ar: 'درجة السفر تغيّر الراحة والسعر.',
    en: 'Cabin class changes comfort and price.',
  },
  hotelPreference: {
    ar: 'تفضيل الإقامة يضيّق نتائج الفنادق المفيدة.',
    en: 'Hotel preference narrows useful stay options.',
  },
  transportation: {
    ar: 'وسيلة التنقل تؤثر على جدول الأيام.',
    en: 'Transport preference shapes the daily itinerary.',
  },
  activities: {
    ar: 'الأنشطة تساعدني أقترح أيام أوضح.',
    en: 'Activities help me suggest clearer day plans.',
  },
  visa: {
    ar: 'التأشيرة قد تكون شرطاً قبل الحجز.',
    en: 'Visa needs may be required before booking.',
  },
  language: {
    ar: 'اللغة تجعل الحوار أوضح لك.',
    en: 'Language keeps the conversation clear for you.',
  },
  currency: {
    ar: 'العملة تجعل الأسعار مفهومة مباشرة.',
    en: 'Currency makes prices immediately understandable.',
  },
  flexibleDates: {
    ar: 'المرونة قد تفتح أسعاراً أفضل.',
    en: 'Flexibility can unlock better prices.',
  },
  specialRequests: {
    ar: 'الطلبات الخاصة تمنع مفاجآت غير مرغوبة.',
    en: 'Special requests avoid unwanted surprises.',
  },
}

/** Priority order for core intake (destination → dates → travelers → budget → preferences). */
const CORE_ORDER: TravelPlanSlotKey[] = [
  'destination',
  'dates',
  'origin',
  'adults',
  'budget',
  'cabin',
  'hotelPreference',
  'activities',
  'children',
  'transportation',
  'flexibleDates',
  'visa',
  'language',
  'currency',
  'specialRequests',
]

export class QuestionGenerator {
  private readonly planner: QuestionPlanner

  constructor(planner?: QuestionPlanner) {
    this.planner = planner ?? new QuestionPlanner()
  }

  /** Return exactly one question, or null when nothing is missing. */
  next(
    missing: TravelPlanSlotKey[],
    slots?: TravelPlanSlots,
    answered: TravelPlanSlotKey[] = [],
  ): ConversationQuestion | null {
    const answeredSet = new Set(answered)
    const pending = missing.filter((m) => !answeredSet.has(m))
    if (pending.length === 0) return null

    // Prefer core intake order, then planner priority.
    const ordered = [...pending].sort((a, b) => {
      const ia = CORE_ORDER.indexOf(a)
      const ib = CORE_ORDER.indexOf(b)
      const pa = ia === -1 ? 999 : ia
      const pb = ib === -1 ? 999 : ib
      return pa - pb
    })

    const planned = this.planner.nextQuestion(ordered, slots)
    const slot = planned?.slot ?? ordered[0]!
    const base = planned ?? {
      slot,
      priority: 50,
      questionAr: 'هل يمكنك توضيح هذه النقطة؟',
      questionEn: 'Could you clarify this point?',
    }
    const why = WHY[slot]

    return {
      slot,
      priority: base.priority,
      questionAr: base.questionAr,
      questionEn: base.questionEn,
      whyAr: why.ar,
      whyEn: why.en,
    }
  }
}

export function createQuestionGenerator(planner?: QuestionPlanner): QuestionGenerator {
  return new QuestionGenerator(planner)
}
