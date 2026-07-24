/**
 * Phase 3 Stage 5 — Generic experience card helpers.
 */

import type { ExperienceCard, ExperienceCardKind, ExperienceLocale } from './types'

let cardSeq = 0

export function createExperienceCard(input: {
  kind: ExperienceCardKind
  title: string
  body: string
  priority?: number
  iconKey?: string | null
  tags?: string[]
}): ExperienceCard {
  cardSeq += 1
  return {
    id: `exp-card-${input.kind}-${cardSeq}`,
    kind: input.kind,
    title: input.title,
    body: input.body,
    priority: input.priority ?? 50,
    iconKey: input.iconKey ?? null,
    tags: input.tags ?? [],
  }
}

export function placeholderCard(
  kind: ExperienceCardKind,
  locale: ExperienceLocale,
  topic: string,
): ExperienceCard {
  const ar = locale === 'ar'
  return createExperienceCard({
    kind,
    title: ar ? `${topic} (قريباً)` : `${topic} (coming soon)`,
    body: ar
      ? `مساحة عرض لـ ${topic} — بدون جلب بيانات خارجية في هذه المرحلة.`
      : `Presentation slot for ${topic} — no external data fetch in this stage.`,
    priority: 20,
    iconKey: kind,
    tags: ['placeholder', topic.toLowerCase()],
  })
}

export const ExperienceCards = {
  create: createExperienceCard,
  placeholder: placeholderCard,
}
