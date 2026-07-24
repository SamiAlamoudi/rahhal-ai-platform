/**
 * Phase 3 Stage 5 — Destination highlight cards (presentation only).
 * Never invents destination facts beyond known cues.
 */

import { createExperienceCard } from './experienceCards'
import type { ExperienceCard } from './types'
import type { ExperienceSourceFacts } from './tripSummary'

export function buildDestinationHighlights(
  facts: ExperienceSourceFacts,
): ExperienceCard[] {
  const ar = facts.locale === 'ar'
  if (!facts.destination) return []

  const cards: ExperienceCard[] = [
    createExperienceCard({
      kind: 'quick_fact',
      title: ar ? 'وجهة التركيز' : 'Focus destination',
      body: facts.destination,
      priority: 88,
      iconKey: 'pin',
      tags: ['destination', 'fact'],
    }),
  ]

  if (facts.executiveLines[1]) {
    cards.push(
      createExperienceCard({
        kind: 'trip_highlight',
        title: ar ? 'لمحة عن الوجهة' : 'Destination note',
        body: facts.executiveLines[1],
        priority: 75,
        iconKey: 'note',
        tags: ['destination', 'note'],
      }),
    )
  } else {
    cards.push(
      createExperienceCard({
        kind: 'trip_highlight',
        title: ar ? 'لمحة عن الوجهة' : 'Destination note',
        body: ar
          ? `تفاصيل ${facts.destination} تُعرض هنا من مخرجات الذكاء الحالية فقط — بدون جلب خارجي.`
          : `${facts.destination} details here come only from current AI outputs — no external fetch.`,
        priority: 60,
        iconKey: 'note',
        tags: ['destination', 'note'],
      }),
    )
  }

  return cards
}

export const DestinationHighlights = {
  build: buildDestinationHighlights,
}
