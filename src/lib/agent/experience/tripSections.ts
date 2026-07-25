/**
 * Phase 3 Stage 5 — Group experience cards into UI sections.
 */

import type { ExperienceCard, ExperienceLocale, ExperienceSection } from './types'

export function buildExperienceSections(input: {
  locale: ExperienceLocale
  executiveSummary: ExperienceCard | null
  tripHighlights: ExperienceCard[]
  destinationHighlights: ExperienceCard[]
  recommendedActions: ExperienceCard[]
  importantAlerts: ExperienceCard[]
  recommendedAlternatives: ExperienceCard[]
  quickFacts: ExperienceCard[]
  placeholders: ExperienceCard[]
}): ExperienceSection[] {
  const ar = input.locale === 'ar'
  const sections: ExperienceSection[] = []

  const overviewCards = [
    ...(input.executiveSummary ? [input.executiveSummary] : []),
    ...input.tripHighlights,
  ]
  if (overviewCards.length) {
    sections.push({
      id: 'section-overview',
      title: ar ? 'نظرة عامة' : 'Overview',
      cards: overviewCards,
    })
  }

  if (input.destinationHighlights.length) {
    sections.push({
      id: 'section-destination',
      title: ar ? 'الوجهة' : 'Destination',
      cards: input.destinationHighlights,
    })
  }

  if (input.importantAlerts.length) {
    sections.push({
      id: 'section-alerts',
      title: ar ? 'تنبيهات مهمة' : 'Important alerts',
      cards: input.importantAlerts,
    })
  }

  if (input.recommendedActions.length) {
    sections.push({
      id: 'section-actions',
      title: ar ? 'إجراءات مقترحة' : 'Recommended actions',
      cards: input.recommendedActions,
    })
  }

  if (input.recommendedAlternatives.length) {
    sections.push({
      id: 'section-alternatives',
      title: ar ? 'بدائل مقترحة' : 'Recommended alternatives',
      cards: input.recommendedAlternatives,
    })
  }

  if (input.quickFacts.length) {
    sections.push({
      id: 'section-facts',
      title: ar ? 'حقائق سريعة' : 'Quick facts',
      cards: input.quickFacts,
    })
  }

  if (input.placeholders.length) {
    sections.push({
      id: 'section-placeholders',
      title: ar ? 'وحدات مستقبلية' : 'Future modules',
      cards: input.placeholders,
    })
  }

  return sections
}

export const TripSections = {
  build: buildExperienceSections,
}
