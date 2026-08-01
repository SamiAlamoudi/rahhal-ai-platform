/**
 * Sprint 85 — Question Generator.
 * Exactly ONE next question for a selected slot (Value Before Questions).
 */

import { QuestionPlanner } from '../planning/QuestionPlanner'
import type { TravelPlanSlotKey, TravelPlanSlots } from '../planning/types'
import type { ClarificationTier, ConversationQuestion } from './types'
import { ClarificationPolicy } from './ClarificationPolicy'

const WHY: Record<string, { ar: string; en: string }> = {
  destination: {
    ar: 'أحتاج الوجهة لأبني تصورًا أوليًا مفيدًا.',
    en: 'I need the destination to build a useful preliminary plan.',
  },
  dates: {
    ar: 'تقريب فترة السفر يضيّق النتائج بشكل واضح.',
    en: 'An approximate travel period materially improves options.',
  },
  origin: {
    ar: 'مدينة المغادرة تغيّر خيارات الرحلات والأسعار التقديرية.',
    en: 'Departure city materially changes flight options and indicative pricing.',
  },
  adults: {
    ar: 'عدد المسافرين يؤثر على التوفر والسعر.',
    en: 'Traveler count affects suitability and indicative cost.',
  },
  children: {
    ar: 'وجود أطفال يغيّر ملاءمة الفنادق والوتيرة.',
    en: 'Children change hotel suitability and trip pacing.',
  },
  budget: {
    ar: 'سقف الميزانية يوجّه الترشيحات دون تجاوز حدودك.',
    en: 'A budget ceiling keeps recommendations within your limits.',
  },
  cabin: {
    ar: 'درجة السفر تغيّر الراحة والسعر.',
    en: 'Cabin class changes comfort and price.',
  },
  hotelPreference: {
    ar: 'تفضيل الإقامة يحسّن التخصيص فقط.',
    en: 'Hotel preference is a refinement, not a blocker.',
  },
  passport: {
    ar: 'بيانات المسافر مطلوبة قبل إصدار التذكرة.',
    en: 'Traveler identity details are required before ticket issuance.',
  },
  payment_consent: {
    ar: 'أحتاج تأكيدك الصريح قبل أي عملية دفع.',
    en: 'I need your explicit confirmation before any charge.',
  },
  traveler_identity: {
    ar: 'بيانات الهوية مطلوبة قبل إتمام الحجز.',
    en: 'Identity details are required before completing a booking.',
  },
}

const FALLBACK_Q: Record<string, { ar: string; en: string }> = {
  origin: {
    ar: 'من أي مدينة ستسافر؟',
    en: 'Which city will you depart from?',
  },
  dates: {
    ar: 'ما الفترة التقريبية التي تناسبك؟',
    en: 'What approximate travel period works for you?',
  },
  adults: {
    ar: 'كم عدد البالغين المسافرين؟',
    en: 'How many adults are traveling?',
  },
  destination: {
    ar: 'إلى أين تود السفر؟',
    en: 'Where would you like to travel?',
  },
  passport: {
    ar: 'ما الاسم الكامل للمسافر كما في جواز السفر؟',
    en: 'What is the traveler full name as on the passport?',
  },
  payment_consent: {
    ar: 'هل تؤكد المتابعة للدفع؟',
    en: 'Do you confirm proceeding to payment?',
  },
  traveler_identity: {
    ar: 'هل يمكنك تأكيد هوية المسافر للحجز؟',
    en: 'Can you confirm traveler identity for booking?',
  },
}

export class QuestionGenerator {
  private readonly planner: QuestionPlanner
  private readonly tiers: ClarificationPolicy

  constructor(planner?: QuestionPlanner) {
    this.planner = planner ?? new QuestionPlanner()
    this.tiers = new ClarificationPolicy()
  }

  /** Build exactly one question for a selected slot. */
  forSlot(
    slot: TravelPlanSlotKey | string,
    slots?: TravelPlanSlots,
  ): ConversationQuestion {
    const tier = this.tiers.classify(String(slot))
    const planned =
      typeof slot === 'string' && this.isPlanSlot(slot)
        ? this.planner.nextQuestion([slot], slots)
        : null
    const fallback = FALLBACK_Q[String(slot)]
    const why = WHY[String(slot)] ?? {
      ar: 'هذا التوضيح يضيّق النتائج بشكل مفيد.',
      en: 'This clarification materially improves the result.',
    }

    return {
      slot,
      tier,
      priority: planned?.priority ?? (tier === 'blocking' ? 100 : 80),
      questionAr: planned?.questionAr ?? fallback?.ar ?? 'هل يمكنك توضيح هذه النقطة؟',
      questionEn: planned?.questionEn ?? fallback?.en ?? 'Could you clarify this point?',
      whyAr: why.ar,
      whyEn: why.en,
    }
  }

  /** Legacy helper — still returns at most one question. */
  next(
    missing: TravelPlanSlotKey[],
    slots?: TravelPlanSlots,
    answered: TravelPlanSlotKey[] = [],
  ): ConversationQuestion | null {
    const answeredSet = new Set(answered)
    const pending = missing.filter((m) => !answeredSet.has(m))
    if (!pending.length) return null
    // Prefer origin over dates for value-first explore flows.
    const ordered = [...pending].sort((a, b) => {
      const order = ['destination', 'origin', 'adults', 'dates', 'budget']
      return (order.indexOf(a) === -1 ? 99 : order.indexOf(a))
        - (order.indexOf(b) === -1 ? 99 : order.indexOf(b))
    })
    return this.forSlot(ordered[0]!, slots)
  }

  private isPlanSlot(slot: string): slot is TravelPlanSlotKey {
    return [
      'origin',
      'destination',
      'dates',
      'flexibleDates',
      'adults',
      'children',
      'cabin',
      'budget',
      'hotelPreference',
      'transportation',
      'activities',
      'visa',
      'language',
      'currency',
      'specialRequests',
    ].includes(slot)
  }
}

export function createQuestionGenerator(planner?: QuestionPlanner): QuestionGenerator {
  return new QuestionGenerator(planner)
}

export type { ClarificationTier }
