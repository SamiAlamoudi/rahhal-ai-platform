/**
 * Evolution Sprint 6 — RecommendationEvidence
 * Evidence from known candidate fields only — never invents facts.
 */

import {
  isoNow,
  newId,
  uniqueStrings,
  type RecommendationCandidate,
  type RecommendationEvidenceItem,
} from './recommendationTypes'

export function collectEvidence(
  candidates: RecommendationCandidate[],
  now?: Date,
): RecommendationEvidenceItem[] {
  const items: RecommendationEvidenceItem[] = []
  const stamp = isoNow(now)

  for (const c of candidates) {
    for (const text of c.evidence ?? []) {
      items.push({
        id: newId('rev', now),
        text,
        weight: 1,
        source: 'candidate.evidence',
        timestamp: stamp,
        candidateId: c.id,
        reasoningRef: c.reasoningRef ?? null,
        reflectionRef: c.reflectionRef ?? null,
      })
    }
    if (c.destinations?.length) {
      items.push({
        id: newId('rev', now),
        text: `Stated destinations: ${c.destinations.join(', ')}`,
        weight: 0.9,
        source: 'candidate.destinations',
        timestamp: stamp,
        candidateId: c.id,
        reasoningRef: c.reasoningRef ?? null,
        reflectionRef: c.reflectionRef ?? null,
      })
    }
    if (typeof c.budget?.amount === 'number') {
      items.push({
        id: newId('rev', now),
        text: `Known budget signal: ${c.budget.amount}${c.budget.currency ? ` ${c.budget.currency}` : ''}`,
        weight: 0.85,
        source: 'candidate.budget',
        timestamp: stamp,
        candidateId: c.id,
        reasoningRef: c.reasoningRef ?? null,
        reflectionRef: c.reflectionRef ?? null,
      })
    }
    if (typeof c.dates?.durationDays === 'number') {
      items.push({
        id: newId('rev', now),
        text: `Known duration: ${c.dates.durationDays} days`,
        weight: 0.7,
        source: 'candidate.dates',
        timestamp: stamp,
        candidateId: c.id,
        reasoningRef: c.reasoningRef ?? null,
        reflectionRef: c.reflectionRef ?? null,
      })
    }
    if (c.whyExists) {
      items.push({
        id: newId('rev', now),
        text: `Branch rationale: ${c.whyExists}`,
        weight: 0.6,
        source: 'candidate.whyExists',
        timestamp: stamp,
        candidateId: c.id,
        reasoningRef: c.reasoningRef ?? null,
        reflectionRef: c.reflectionRef ?? null,
      })
    }
  }

  return items
}

export function evidenceTexts(items: RecommendationEvidenceItem[]): string[] {
  return uniqueStrings(items.map((i) => i.text))
}

export const RecommendationEvidence = {
  collect: collectEvidence,
  texts: evidenceTexts,
}
