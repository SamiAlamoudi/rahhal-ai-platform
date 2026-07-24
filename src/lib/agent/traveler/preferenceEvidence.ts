/**
 * Evolution Sprint 5 — PreferenceEvidence
 * Build evidence items attached to every preference signal.
 */

import {
  isoNow,
  newId,
  type PreferenceEvidenceItem,
} from './travelerTypes'

export function createEvidence(options: {
  text: string
  conversationSource: string
  reasoningRef?: string | null
  reflectionRef?: string | null
  weight?: number
  now?: Date
}): PreferenceEvidenceItem {
  return {
    id: newId('ev', options.now),
    text: options.text,
    timestamp: isoNow(options.now),
    conversationSource: options.conversationSource,
    reasoningRef: options.reasoningRef ?? null,
    reflectionRef: options.reflectionRef ?? null,
    weight: options.weight ?? 1,
  }
}

export function mergeEvidence(
  existing: PreferenceEvidenceItem[],
  incoming: PreferenceEvidenceItem[],
  max = 24,
): PreferenceEvidenceItem[] {
  const byId = new Map<string, PreferenceEvidenceItem>()
  for (const e of [...existing, ...incoming]) byId.set(e.id, e)
  return [...byId.values()]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-max)
}

export const PreferenceEvidence = {
  create: createEvidence,
  merge: mergeEvidence,
}
