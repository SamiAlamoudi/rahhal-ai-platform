/**
 * Phase 3 Stage 5 — Trip highlight cards (presentation only).
 */

import { createExperienceCard } from './experienceCards'
import type { ExperienceCard } from './types'
import type { ExperienceSourceFacts } from './tripSummary'

export function buildTripHighlights(facts: ExperienceSourceFacts): ExperienceCard[] {
  const ar = facts.locale === 'ar'
  const cards: ExperienceCard[] = []

  if (facts.destination) {
    cards.push(
      createExperienceCard({
        kind: 'trip_highlight',
        title: ar ? 'الوجهة' : 'Destination',
        body: facts.destination,
        priority: 90,
        iconKey: 'destination',
        tags: ['highlight', 'destination'],
      }),
    )
  }
  if (facts.durationDays != null) {
    cards.push(
      createExperienceCard({
        kind: 'trip_highlight',
        title: ar ? 'المدة' : 'Duration',
        body: ar ? `${facts.durationDays} أيام` : `${facts.durationDays} days`,
        priority: 85,
        iconKey: 'duration',
        tags: ['highlight', 'duration'],
      }),
    )
  }
  if (facts.budgetAmount != null) {
    cards.push(
      createExperienceCard({
        kind: 'trip_highlight',
        title: ar ? 'الميزانية' : 'Budget',
        body: `${facts.budgetAmount} ${facts.budgetCurrency ?? 'SAR'}`,
        priority: 84,
        iconKey: 'budget',
        tags: ['highlight', 'budget'],
      }),
    )
  }
  if (facts.tripPurpose) {
    cards.push(
      createExperienceCard({
        kind: 'trip_highlight',
        title: ar ? 'غرض الرحلة' : 'Trip purpose',
        body: facts.tripPurpose,
        priority: 80,
        iconKey: 'purpose',
        tags: ['highlight', 'purpose'],
      }),
    )
  }
  for (const interest of facts.interests.slice(0, 3)) {
    cards.push(
      createExperienceCard({
        kind: 'trip_highlight',
        title: ar ? 'اهتمام' : 'Interest',
        body: interest,
        priority: 70,
        iconKey: 'interest',
        tags: ['highlight', 'interest'],
      }),
    )
  }
  return cards
}

export const TripHighlights = {
  build: buildTripHighlights,
}
