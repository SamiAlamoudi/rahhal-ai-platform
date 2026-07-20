/**
 * Phase 2 — Rejected destination learning.
 * "Not Norway" → never suggest again.
 */

import type { PreferenceEngine, PersonalizationProfile } from '../../ai/preferences'
import { getPreferenceEngine } from '../../ai/preferences'
import { findDestinationProfile, DESTINATION_CATALOG } from '../../agent/reasoning/destinationCatalog'
import type { TravelReasoningResult } from '../../agent/reasoning/types'
import type { AgentLocale } from '../../agent/types'

const REJECT_PATTERNS_EN = [
  /\b(?:do\s+not|don'?t)\s+want\s+([a-z][a-z\s-]{1,40})/gi,
  /\b(?:not|no|skip|avoid|without)\s+([a-z][a-z\s-]{1,30})/gi,
  /\b(?:not|no)\s+(?:interested in|going to)\s+([a-z][a-z\s-]{1,30})/gi,
]

const REJECT_MARKERS_AR = [
  /(?:ما\s*(?:أبغى|ابغى|أريد|اريد)|ليس|مو|بدون)\s+([^\s،,.!؟]+)/g,
  /(?:لا\s*(?:أريد|اريد|أبغى|ابغى))\s+([^\s،,.!؟]+)/g,
]

export function detectRejectedDestinations(
  text: string,
  locale: AgentLocale,
): string[] {
  const found = new Set<string>()
  const lower = text.toLowerCase()

  for (const pattern of REJECT_PATTERNS_EN) {
    let match: RegExpExecArray | null
    const re = new RegExp(pattern.source, pattern.flags)
    while ((match = re.exec(lower)) !== null) {
      const raw = match[1]?.trim()
      if (raw) resolveDestinationName(raw, locale).forEach((name) => found.add(name))
    }
  }

  if (locale === 'ar' || /[\u0600-\u06FF]/.test(text)) {
    for (const pattern of REJECT_MARKERS_AR) {
      let match: RegExpExecArray | null
      const re = new RegExp(pattern.source, pattern.flags)
      while ((match = re.exec(text)) !== null) {
        const raw = match[1]?.trim()
        if (raw) resolveDestinationName(raw, locale).forEach((name) => found.add(name))
      }
    }
  }

  // Catalog scan with negative context
  for (const profile of DESTINATION_CATALOG) {
    const names = [profile.nameEn, profile.nameAr, profile.id]
    for (const name of names) {
      if (!name) continue
      const nameLower = name.toLowerCase()
      if (
        lower.includes(`not ${nameLower}`)
        || lower.includes(`no ${nameLower}`)
        || text.includes(`ما أبغى ${name}`)
        || text.includes(`لا ${name}`)
      ) {
        found.add(profile.nameEn)
      }
    }
  }

  return [...found]
}

export function learnRejectedDestinations(
  text: string,
  userId: string | null,
  engine: PreferenceEngine = getPreferenceEngine(),
): string[] {
  const profile = engine.getProfile(userId)
  const detected = detectRejectedDestinations(text, 'en')
    .concat(detectRejectedDestinations(text, 'ar'))
  if (detected.length === 0) return []

  const merged = unique([
    ...profile.travelStyle.rejectedDestinations,
    ...detected,
  ])

  const next: PersonalizationProfile = {
    ...profile,
    userId,
    updatedAt: new Date().toISOString(),
    travelStyle: {
      ...profile.travelStyle,
      rejectedDestinations: merged,
    },
  }
  engine.upsertProfile(next)
  return detected
}

export function applyRejectedDestinationsFilter(
  result: TravelReasoningResult,
  rejected: string[],
  locale: AgentLocale,
): TravelReasoningResult {
  if (rejected.length === 0) return result

  const rejectedLower = rejected.map((name) => name.toLowerCase())
  const isRejected = (row: { id: string; name: string; nameAr: string }) =>
    rejectedLower.some((token) =>
      row.id.toLowerCase() === token
      || row.name.toLowerCase() === token
      || row.nameAr.includes(token)
      || token.includes(row.name.toLowerCase()),
    )

  const demote = (
    row: NonNullable<TravelReasoningResult['primary']>,
  ): NonNullable<TravelReasoningResult['primary']> => ({
    ...row,
    score: Math.max(0, row.score - 0.5),
    whyRejected: [
      ...(row.whyRejected ?? []),
      locale === 'ar'
        ? 'استبعدتها لأنك ذكرت أنك لا تريد هذه الوجهة سابقاً'
        : 'Excluded because you previously rejected this destination',
    ],
  })

  let primary = result.primary
  let alternatives = [...result.alternatives]
  let rejectedRows = [...result.rejected]

  if (primary && isRejected(primary)) {
    rejectedRows = [demote(primary), ...rejectedRows]
    primary = alternatives.find((row) => !isRejected(row)) ?? null
    alternatives = alternatives.filter((row) => !isRejected(row))
  }

  alternatives = alternatives.filter((row) => {
    if (isRejected(row)) {
      rejectedRows.push(demote(row))
      return false
    }
    return true
  })

  if (!primary && alternatives.length > 0) {
    primary = alternatives[0] ?? null
    alternatives = alternatives.slice(1)
  }

  return {
    ...result,
    primary,
    alternatives,
    rejected: rejectedRows.slice(0, 5),
  }
}

function resolveDestinationName(raw: string, locale: AgentLocale): string[] {
  const cleaned = raw.replace(/[?.!].*$/, '').trim()
  if (!cleaned || cleaned.length < 2) return []

  const profile = findDestinationProfile(cleaned)
  if (profile) return [profile.nameEn]

  const hit = DESTINATION_CATALOG.find((row) =>
    row.nameEn.toLowerCase().includes(cleaned.toLowerCase())
    || row.nameAr.includes(cleaned)
    || row.id === cleaned.toLowerCase(),
  )
  if (hit) return [hit.nameEn]

  if (locale === 'en' && cleaned.length >= 3) {
    return [cleaned.charAt(0).toUpperCase() + cleaned.slice(1)]
  }
  return []
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}
