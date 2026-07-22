/**
 * Sprint 99 — assemble AlphaExperienceDTO from prioritized sections.
 */

import type {
  AlphaExperienceComposeInput,
  AlphaExperienceDTO,
  ExperienceSectionId,
  TravelerExperienceSection,
} from './AlphaExperienceDTO'
import { SPRINT99_ALPHA_ASSEMBLY_VERSION } from './AlphaExperienceDTO'
import { compareSectionIds } from './ExperiencePriority'
import { buildExperienceSections } from './ExperienceSections'
import { buildFinalRecommendationText } from './TravelerRecommendation'
import { buildTravelerKeyReasons } from './TravelerSummary'

function newConversationId(now: number): string {
  return `alpha_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Deduplicate sections that would repeat the same primary text blob.
 * Keeps higher-priority section when texts collide.
 */
export function dedupeExperienceSections(
  sections: TravelerExperienceSection[],
): TravelerExperienceSection[] {
  const sorted = [...sections].sort((a, b) => compareSectionIds(a.id, b.id))
  const seenText = new Set<string>()
  const out: TravelerExperienceSection[] = []

  for (const section of sorted) {
    const fingerprint = sectionFingerprint(section)
    if (fingerprint && seenText.has(fingerprint)) continue
    if (fingerprint) seenText.add(fingerprint)
    out.push(section)
  }
  return out
}

function sectionFingerprint(section: TravelerExperienceSection): string | null {
  switch (section.id) {
    case 'explanation':
      return normalize(section.summary)
    case 'summary':
      return normalize(section.text)
    case 'concierge':
      return normalize(section.explanation)
    case 'price':
      return normalize(section.note)
    case 'package':
      return normalize(section.explanation ?? section.title)
    default:
      return null
  }
}

function normalize(value: string | null | undefined): string | null {
  if (!value) return null
  const t = value.replace(/\s+/g, ' ').trim().toLowerCase()
  return t.length > 0 ? t : null
}

export function buildAlphaExperienceDTO(
  input: AlphaExperienceComposeInput,
  options?: { enabled?: boolean; startedAt?: number },
): AlphaExperienceDTO {
  const started = options?.startedAt ?? Date.now()
  const enabled = options?.enabled !== false
  if (!enabled) {
    return {
      version: SPRINT99_ALPHA_ASSEMBLY_VERSION,
      conversationId: input.conversationId?.trim() || newConversationId(started),
      enabled: false,
      sections: [],
      sectionIds: [],
      finalRecommendation: null,
      confidenceLevel: null,
      confidenceScore: null,
      nextAction: null,
      durationMs: Math.max(0, Date.now() - started),
    }
  }

  const sections = dedupeExperienceSections(buildExperienceSections(input))
  const sectionIds = sections.map((s) => s.id) as ExperienceSectionId[]
  const confidence = sections.find((s) => s.id === 'confidence')
  const next = sections.find((s) => s.id === 'next_action')

  // Touch key reasons to ensure summary path stays warm for consumers.
  void buildTravelerKeyReasons(input)

  return {
    version: SPRINT99_ALPHA_ASSEMBLY_VERSION,
    conversationId: input.conversationId?.trim() || newConversationId(started),
    enabled: true,
    sections,
    sectionIds,
    finalRecommendation: buildFinalRecommendationText(input),
    confidenceLevel: confidence && confidence.id === 'confidence' ? confidence.level : null,
    confidenceScore: confidence && confidence.id === 'confidence' ? confidence.score : null,
    nextAction: next && next.id === 'next_action' ? next.action : null,
    durationMs: Math.max(0, Date.now() - started),
  }
}
