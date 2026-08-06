/**
 * Entity extraction — natural language → trip requirements patch.
 * Wraps the product extractFromUserText pipeline (AR/EN), then applies
 * Bilamo consultant enrichments for natural traveler phrasing.
 */

import { extractFromUserText, type ExtractionResult } from '../../agent/extractRequirements'
import { resolveDestinationIdentity } from '../../agent/destinationIdentity'
import type { AgentLocale, TripRequirements } from '../../agent/types'
import { mergeRequirements } from '../../agent/memory'
import { inferSoftRequirements } from '../../agent/clarification'
import { applyPreferencesToRequirements } from './smartMemory'
import type { BilamoConsultantMemory } from './types'

export interface BilamoExtraction {
  locale: AgentLocale
  intent: ExtractionResult['intent']
  patch: Partial<TripRequirements>
  flags?: ExtractionResult['flags']
  /** Requirements after merge + soft inference + preference recall. */
  requirements: TripRequirements
}

/** Compact destination aliases for Arabic clitic forms (لليابان، لباريس…). */
const BILAMO_DESTINATION_KEYS: Array<{ keys: string[]; value: string }> = [
  { keys: ['japan', 'اليابان', 'يابان', 'طوكيو', 'tokyo'], value: 'Japan' },
  { keys: ['paris', 'باريس', 'فرنسا'], value: 'Paris' },
  { keys: ['istanbul', 'اسطنبول', 'إسطنبول', 'تركيا'], value: 'Istanbul' },
  { keys: ['dubai', 'دبي'], value: 'Dubai' },
  { keys: ['london', 'لندن'], value: 'London' },
  { keys: ['lisbon', 'لشبونة', 'ليسбон'], value: 'Lisbon' },
  { keys: ['bali', 'بالي'], value: 'Bali' },
  { keys: ['maldives', 'المالديف'], value: 'Maldives' },
  { keys: ['rome', 'روما'], value: 'Rome' },
  { keys: ['cairo', 'القاهرة', 'مصر'], value: 'Cairo' },
]

function stripArabicClitics(token: string): string {
  return token
    .replace(/^[\s،,]+/, '')
    .replace(/^(?:و|ب|ل|ف|ك)+/, '')
    .replace(/^ال/, '')
}

function enrichConsultantPatch(
  userText: string,
  patch: Partial<TripRequirements>,
): Partial<TripRequirements> {
  const text = userText.trim()
  const lower = text.toLowerCase()
  const next: Partial<TripRequirements> = { ...patch }

  // Party-size phrasing the base extractor misses.
  if (next.travelers == null) {
    const familyOf = lower.match(
      /\b(?:family|party|group)\s+of\s+(\d{1,2})\b|\b(\d{1,2})\s+(?:travelers?|adults?|people|persons?)\b/,
    )
    const arabicFamily = text.match(/(?:عائلة|أسرة|اسرة)\s*(?:من\s*)?(\d{1,2})|ل(?:ـ)?(\d{1,2})\s*أشخاص/)
    if (familyOf) {
      const n = Number(familyOf[1] || familyOf[2])
      if (n > 0) {
        next.travelers = n
        next.travelerType = next.travelerType ?? (n >= 3 ? 'family' : n === 2 ? 'couple' : 'solo')
        if (n >= 3) next.children = next.children ?? Math.max(0, n - 2)
      }
    } else if (arabicFamily) {
      const n = Number(arabicFamily[1] || arabicFamily[2])
      if (n > 0) {
        next.travelers = n
        next.travelerType = next.travelerType ?? (n >= 3 ? 'family' : n === 2 ? 'couple' : 'solo')
      }
    } else if (
      /\b(?:just|only)\s+me\b|\bby myself\b|\bon my own\b|\bmyself\b/.test(lower)
      || /لحالي|بنفس[يى]|أنا\s*وحدي|انا\s*وحدي/.test(text)
    ) {
      next.travelers = 1
      next.travelerType = next.travelerType ?? 'solo'
    } else if (
      /\btwo of us\b|\bthe two of us\b|\bus two\b|\bboth of us\b/.test(lower)
      || /اثنين\s*احنا|إحنا\s*اثنين|نحن\s*اثنين/.test(text)
    ) {
      next.travelers = 2
      next.travelerType = next.travelerType ?? 'couple'
    } else if (/\bfamily\b|عائلة|أسرة|اسرة/.test(lower) || /عائلة|أسرة|اسرة/.test(text)) {
      next.travelers = next.travelers ?? 4
      next.travelerType = next.travelerType ?? 'family'
      next.children = next.children ?? 2
    }
  }

  // Airline brand names (Saudia, not only "Saudi Airlines" / SV).
  if (!next.preferredAirline) {
    if (/\bsaudia\b|\bsaudi\s*air(?:lines?)?\b|\bsv\b/.test(lower) || /السعودية|سعوديه/.test(text)) {
      next.preferredAirline = 'SV'
    } else if (/\bemirates\b|\bek\b/.test(lower) || /الإمارات|الامارات/.test(text)) {
      next.preferredAirline = 'EK'
    } else if (/\bqatar\b|\bqr\b/.test(lower) || /القطرية/.test(text)) {
      next.preferredAirline = 'QR'
    }
  }

  // Direct / nonstop preference — stored in notes for the flight orchestrator.
  if (/\bdirect\b|\bnon[-\s]?stop\b|بدون\s*توقف|مباشر/.test(lower) || /بدون\s*توقف|رحلة\s*مباشرة/.test(text)) {
    const note = 'prefer_direct_flights'
    next.notes = next.notes ? `${next.notes}; ${note}` : note
  }

  // Arabic / loose destination recovery when base extractor missed clitics (لليابان).
  if (!next.destination && !(next.destinations && next.destinations.length > 0)) {
    const tokens = text.split(/[\s،,.\-!?؟]+/).filter(Boolean)
    const haystack = [lower, text, ...tokens.map(stripArabicClitics)]
    for (const entry of BILAMO_DESTINATION_KEYS) {
      if (entry.keys.some((key) => haystack.some((h) => h.toLowerCase().includes(key)))) {
        const identity = resolveDestinationIdentity(entry.value)
        next.destination = identity?.label ?? entry.value
        next.destinations = [next.destination]
        next.destinationCity = identity?.city ?? null
        next.destinationCountry = identity?.country ?? null
        break
      }
    }
  }

  return next
}

/**
 * High-confidence party-size bridges for consultant answers.
 * "Couple" / "solo" in reply to the travelers question is a stated party size.
 */
function bridgePartySize(req: TripRequirements): TripRequirements {
  if (req.travelers != null) return req
  if (req.travelerType === 'solo') return { ...req, travelers: 1 }
  if (req.travelerType === 'couple') return { ...req, travelers: 2 }
  return req
}

export function extractBilamoEntities(input: {
  userText: string
  memory: BilamoConsultantMemory
}): BilamoExtraction {
  const extracted = extractFromUserText(input.userText, input.memory.locale)
  const locale = extracted.locale || input.memory.locale
  const patch = enrichConsultantPatch(input.userText, extracted.patch)
  const replaceDestinations = extracted.flags?.replaceDestinations === true
    || Boolean(patch.destination && patch.destination !== input.memory.agent.requirements.destination)

  const merged = mergeRequirements(input.memory.agent.requirements, patch, {
    replaceDestinations,
  })
  const withPrefs = applyPreferencesToRequirements(merged, input.memory.preferences)
  const soft = inferSoftRequirements(withPrefs, { locale: locale === 'en' ? 'en' : 'ar' })
  const requirements = bridgePartySize(soft.requirements)

  return {
    locale,
    intent: extracted.intent,
    patch,
    flags: {
      ...extracted.flags,
      replaceDestinations: replaceDestinations || extracted.flags?.replaceDestinations,
    },
    requirements,
  }
}
