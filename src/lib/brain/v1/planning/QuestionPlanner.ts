/**
 * Sprint 84 — Question Planner.
 * Ask only ONE highest-priority missing question.
 */

import type { TravelPlanQuestion, TravelPlanSlotKey, TravelPlanSlots } from './types'

const QUESTIONS: Record<TravelPlanSlotKey, { ar: string; en: string; priority: number }> = {
  destination: {
    ar: 'إلى أين تود السفر؟',
    en: 'Where would you like to travel?',
    priority: 100,
  },
  dates: {
    ar: 'متى تود السفر؟',
    en: 'When would you like to travel?',
    priority: 90,
  },
  origin: {
    ar: 'من أي مدينة ستسافر؟',
    en: 'Which city will you depart from?',
    priority: 80,
  },
  adults: {
    ar: 'كم عدد البالغين المسافرين؟',
    en: 'How many adults are traveling?',
    priority: 70,
  },
  children: {
    ar: 'هل يسافر معك أطفال؟ كم عددهم؟',
    en: 'Are children traveling with you? How many?',
    priority: 40,
  },
  budget: {
    ar: 'ما هي ميزانيتك تقريباً؟',
    en: 'What is your approximate budget?',
    priority: 35,
  },
  cabin: {
    ar: 'هل تفضل الدرجة السياحية أم رجال الأعمال؟',
    en: 'Do you prefer economy or business class?',
    priority: 30,
  },
  hotelPreference: {
    ar: 'ما نوع الإقامة التي تفضلها؟',
    en: 'What hotel preference do you have?',
    priority: 25,
  },
  transportation: {
    ar: 'كيف تفضل التنقل في الوجهة؟',
    en: 'How do you prefer to get around at the destination?',
    priority: 20,
  },
  activities: {
    ar: 'ما الأنشطة التي تهمك؟',
    en: 'Which activities interest you?',
    priority: 18,
  },
  visa: {
    ar: 'هل تحتاج مساعدة بخصوص التأشيرة؟',
    en: 'Do you need help with a visa?',
    priority: 15,
  },
  language: {
    ar: 'بأي لغة تفضل المتابعة؟',
    en: 'Which language do you prefer?',
    priority: 10,
  },
  currency: {
    ar: 'بأي عملة تريد عرض الأسعار؟',
    en: 'Which currency should I use for prices?',
    priority: 10,
  },
  flexibleDates: {
    ar: 'هل تواريخك مرنة؟',
    en: 'Are your dates flexible?',
    priority: 50,
  },
  specialRequests: {
    ar: 'هل لديك طلبات خاصة؟',
    en: 'Do you have any special requests?',
    priority: 5,
  },
}

export class QuestionPlanner {
  /** Return at most one highest-priority question from missing slots. */
  nextQuestion(
    missing: TravelPlanSlotKey[],
    _slots?: TravelPlanSlots,
  ): TravelPlanQuestion | null {
    if (missing.length === 0) return null
    const ranked = [...missing].sort(
      (a, b) => (QUESTIONS[b]?.priority ?? 0) - (QUESTIONS[a]?.priority ?? 0),
    )
    const slot = ranked[0]!
    const q = QUESTIONS[slot]
    return {
      slot,
      priority: q.priority,
      questionAr: q.ar,
      questionEn: q.en,
    }
  }
}

export function createQuestionPlanner(): QuestionPlanner {
  return new QuestionPlanner()
}
