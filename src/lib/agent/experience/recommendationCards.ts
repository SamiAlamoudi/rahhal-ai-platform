/**
 * Phase 3 Stage 5 — Recommended action / alternative / alert cards.
 */

import { createExperienceCard, placeholderCard } from './experienceCards'
import type { ExperienceCard, ExperienceLocale } from './types'
import type { ExperienceSourceFacts } from './tripSummary'

export function buildRecommendedActionCards(
  facts: ExperienceSourceFacts,
): ExperienceCard[] {
  const ar = facts.locale === 'ar'
  const cards: ExperienceCard[] = []

  if (facts.missingInformation.includes('destination') || !facts.destination) {
    cards.push(
      createExperienceCard({
        kind: 'recommended_action',
        title: ar ? 'حدد الوجهة' : 'Choose a destination',
        body: ar
          ? 'شارك الوجهة لنجهّز بطاقات التجربة التالية.'
          : 'Share a destination so we can shape the next experience cards.',
        priority: 95,
        iconKey: 'action',
        tags: ['action'],
      }),
    )
  }
  if (facts.missingInformation.includes('budget') || facts.budgetAmount == null) {
    cards.push(
      createExperienceCard({
        kind: 'recommended_action',
        title: ar ? 'أضف الميزانية' : 'Add a budget',
        body: ar
          ? 'الميزانية تساعد في بطاقات التكلفة والتنبيهات.'
          : 'Budget helps populate cost cards and alerts.',
        priority: 90,
        iconKey: 'action',
        tags: ['action', 'budget'],
      }),
    )
  }
  if (facts.nextQuestions[0]) {
    cards.push(
      createExperienceCard({
        kind: 'next_question',
        title: ar ? 'سؤال مقترح' : 'Suggested question',
        body: facts.nextQuestions[0],
        priority: 88,
        iconKey: 'question',
        tags: ['question'],
      }),
    )
  }
  if (cards.length === 0) {
    cards.push(
      createExperienceCard({
        kind: 'recommended_action',
        title: ar ? 'راجع الملخص' : 'Review the summary',
        body: ar
          ? 'المعلومات كافية لعرض تجربة أولية — التخطيط لم يتغير.'
          : 'Enough context for an initial experience view — planning unchanged.',
        priority: 70,
        iconKey: 'action',
        tags: ['action'],
      }),
    )
  }
  return cards.slice(0, 4)
}

export function buildImportantAlertCards(
  facts: ExperienceSourceFacts,
): ExperienceCard[] {
  return facts.alerts.slice(0, 4).map((alert, i) =>
    createExperienceCard({
      kind: 'alert',
      title: facts.locale === 'ar' ? 'تنبيه' : 'Alert',
      body: alert,
      priority: 80 - i,
      iconKey: 'alert',
      tags: ['alert'],
    }),
  )
}

export function buildAlternativeCards(
  facts: ExperienceSourceFacts,
): ExperienceCard[] {
  const ar = facts.locale === 'ar'
  return facts.alternatives.slice(0, 4).map((dest, i) =>
    createExperienceCard({
      kind: 'alternative',
      title: ar ? `بديل: ${dest}` : `Alternative: ${dest}`,
      body: ar
        ? 'خيار مقارن من طبقة الذكاء — للعرض فقط.'
        : 'Comparative option from intelligence layer — presentation only.',
      priority: 65 - i,
      iconKey: 'alternative',
      tags: ['alternative', dest.toLowerCase()],
    }),
  )
}

export function buildQuickFactCards(facts: ExperienceSourceFacts): ExperienceCard[] {
  const ar = facts.locale === 'ar'
  const cards: ExperienceCard[] = []
  cards.push(
    createExperienceCard({
      kind: 'quick_fact',
      title: ar ? 'الثقة' : 'Confidence',
      body: `${Math.round(facts.confidence * 100)}%`,
      priority: 55,
      iconKey: 'confidence',
      tags: ['fact', 'confidence'],
    }),
  )
  for (const m of facts.missingInformation.slice(0, 3)) {
    cards.push(
      createExperienceCard({
        kind: 'missing_info',
        title: ar ? 'معلومة ناقصة' : 'Missing information',
        body: m,
        priority: 50,
        iconKey: 'missing',
        tags: ['missing'],
      }),
    )
  }
  return cards
}

export function buildPlaceholderCards(locale: ExperienceLocale): {
  weather: ExperienceCard
  visa: ExperienceCard
  transportation: ExperienceCard
  hotel: ExperienceCard
  flight: ExperienceCard
  budget: ExperienceCard
} {
  return {
    weather: placeholderCard('weather_placeholder', locale, locale === 'ar' ? 'الطقس' : 'Weather'),
    visa: placeholderCard('visa_placeholder', locale, locale === 'ar' ? 'التأشيرة' : 'Visa'),
    transportation: placeholderCard(
      'transportation_placeholder',
      locale,
      locale === 'ar' ? 'المواصلات' : 'Transportation',
    ),
    hotel: placeholderCard('hotel_placeholder', locale, locale === 'ar' ? 'الفندق' : 'Hotel'),
    flight: placeholderCard('flight_placeholder', locale, locale === 'ar' ? 'الطيران' : 'Flight'),
    budget: placeholderCard('budget_placeholder', locale, locale === 'ar' ? 'الميزانية' : 'Budget'),
  }
}

export const RecommendationCards = {
  actions: buildRecommendedActionCards,
  alerts: buildImportantAlertCards,
  alternatives: buildAlternativeCards,
  quickFacts: buildQuickFactCards,
  placeholders: buildPlaceholderCards,
}
