/**
 * Sprint 99 — section priority ranking for Alpha Experience assembly.
 */

import type { ExperiencePriorityLevel, ExperienceSectionId } from './AlphaExperienceDTO'

export const EXPERIENCE_SECTION_PRIORITY: Record<ExperienceSectionId, ExperiencePriorityLevel> = {
  confidence: 'critical',
  price: 'critical',
  package: 'high',
  flight: 'high',
  hotel: 'high',
  alternatives: 'high',
  concierge: 'high',
  explanation: 'medium',
  summary: 'medium',
  timeline: 'medium',
  next_action: 'low',
}

const LEVEL_RANK: Record<ExperiencePriorityLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

/** Preferred display order within the same priority band. */
const SECTION_ORDER: ExperienceSectionId[] = [
  'confidence',
  'price',
  'package',
  'flight',
  'hotel',
  'alternatives',
  'concierge',
  'explanation',
  'summary',
  'timeline',
  'next_action',
]

export function priorityForSection(id: ExperienceSectionId): ExperiencePriorityLevel {
  return EXPERIENCE_SECTION_PRIORITY[id]
}

export function compareSectionIds(a: ExperienceSectionId, b: ExperienceSectionId): number {
  const pa = LEVEL_RANK[priorityForSection(a)]
  const pb = LEVEL_RANK[priorityForSection(b)]
  if (pa !== pb) return pa - pb
  return SECTION_ORDER.indexOf(a) - SECTION_ORDER.indexOf(b)
}
