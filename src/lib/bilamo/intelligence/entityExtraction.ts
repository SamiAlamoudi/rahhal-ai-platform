/**
 * Entity extraction — natural language → trip requirements patch.
 *
 * Pipeline:
 *   Speech/Text → Arabic Dialect Detection → Arabic Normalization
 *   → Intent/Entity (product extractors on canonical text) → Memory
 *
 * The Intelligence Layer never depends on dialect-specific wording.
 */

import { extractFromUserText, type ExtractionResult } from '../../agent/extractRequirements'
import { resolveDestinationIdentity } from '../../agent/destinationIdentity'
import type { AgentLocale, TripRequirements } from '../../agent/types'
import { mergeRequirements } from '../../agent/memory'
import { inferSoftRequirements } from '../../agent/clarification'
import {
  runBilamoArabicIntelligence,
  type BilamoArabicNormalizeResult,
} from '../arabic'
import { applyPreferencesToRequirements } from './smartMemory'
import type { BilamoConsultantMemory } from './types'

export interface BilamoExtraction {
  locale: AgentLocale
  intent: ExtractionResult['intent']
  patch: Partial<TripRequirements>
  flags?: ExtractionResult['flags']
  /** Requirements after merge + soft inference + preference recall. */
  requirements: TripRequirements
  /** Arabic Language Intelligence snapshot (dialect + normalized text). */
  arabic: BilamoArabicNormalizeResult
}

/** Compact destination aliases for Arabic clitic forms (لليابان، لباريس…). */
const BILAMO_DESTINATION_KEYS: Array<{ keys: string[]; value: string }> = [
  { keys: ['japan', 'اليابان', 'يابان', 'طوكيو', 'tokyo'], value: 'Japan' },
  { keys: ['paris', 'باريس', 'فرنسا'], value: 'Paris' },
  { keys: ['istanbul', 'اسطنبول', 'إسطنبول', 'تركيا'], value: 'Istanbul' },
  { keys: ['dubai', 'دبي'], value: 'Dubai' },
  { keys: ['london', 'لندن'], value: 'London' },
  { keys: ['lisbon', 'لشبونة', 'ليسبون'], value: 'Lisbon' },
  { keys: ['bali', 'بالي'], value: 'Bali' },
  { keys: ['maldives', 'المالديف'], value: 'Maldives' },
  { keys: ['rome', 'روما'], value: 'Rome' },
  { keys: ['cairo', 'القاهرة', 'مصر'], value: 'Cairo' },
  { keys: ['kuwait', 'الكويت'], value: 'Kuwait' },
  { keys: ['doha', 'الدوحة'], value: 'Doha' },
  { keys: ['beirut', 'بيروت'], value: 'Beirut' },
  { keys: ['baghdad', 'بغداد'], value: 'Baghdad' },
  { keys: ['muscat', 'مسقط'], value: 'Muscat' },
  { keys: ['khartoum', 'الخرطوم'], value: 'Khartoum' },
  { keys: ['tunis', 'tunisia', 'تونس'], value: 'Tunis' },
  { keys: ['turkey', 'تركيا'], value: 'Istanbul' },
]

function stripArabicClitics(token: string): string {
  return token
    .replace(/^[\s،,]+/, '')
    .replace(/^(?:و|ب|ل|ف|ك)+/, '')
    .replace(/^ال/, '')
}

function applyArabicHints(
  patch: Partial<TripRequirements>,
  arabic: BilamoArabicNormalizeResult,
): Partial<TripRequirements> {
  const next = { ...patch }
  const { hints } = arabic
  if (next.travelers == null && hints.travelers != null) {
    next.travelers = hints.travelers
  }
  if (next.travelerType == null && hints.travelerType != null) {
    next.travelerType = hints.travelerType
  }
  if (next.children == null && hints.children != null) {
    next.children = hints.children
  }
  // Relative date soft signal — duration / flexibility when extractor missed dates.
  if (
    hints.relativeDateHint
    && next.startDate == null
    && next.durationDays == null
  ) {
    if (
      hints.relativeDateHint === 'next_week'
      || hints.relativeDateHint === 'after_one_week'
      || hints.relativeDateHint === 'weekend'
    ) {
      next.durationDays = next.durationDays ?? 4
      next.datesFlexible = next.datesFlexible ?? true
    } else if (hints.relativeDateHint === 'after_two_weeks') {
      next.durationDays = next.durationDays ?? 7
      next.datesFlexible = next.datesFlexible ?? true
    } else if (
      hints.relativeDateHint === 'this_summer'
      || hints.relativeDateHint === 'after_eid'
      || hints.relativeDateHint === 'end_of_month'
      || hints.relativeDateHint === 'early_august'
      || hints.relativeDateHint === 'mid_september'
      || hints.relativeDateHint === 'end_of_year'
    ) {
      next.datesFlexible = true
      next.durationDays = next.durationDays ?? 5
    }
  }
  return next
}

function enrichConsultantPatch(
  userText: string,
  patch: Partial<TripRequirements>,
): Partial<TripRequirements> {
  const text = userText.trim()
  const lower = text.toLowerCase()
  const next: Partial<TripRequirements> = { ...patch }

  if (next.travelers == null) {
    if (
      /\b(?:just|only)\s+me\b|\bby myself\b|\bon my own\b|\bmyself\b/.test(lower)
      || /لحالي|بنفس[يى]|أنا\s*وحدي|انا\s*وحدي|شخص\s*واحد/.test(text)
    ) {
      next.travelers = 1
      next.travelerType = next.travelerType ?? 'solo'
    } else if (
      /\btwo of us\b|\bthe two of us\b|\bus two\b|\bboth of us\b/.test(lower)
      || /اثنين\s*احنا|إحنا\s*اثنين|نحن\s*اثنين|لشخصين/.test(text)
    ) {
      next.travelers = 2
      next.travelerType = next.travelerType ?? 'couple'
    } else if (/عائلة\s*من\s*(\d+)/.test(text)) {
      const n = Number(text.match(/عائلة\s*من\s*(\d+)/)?.[1] || 4)
      next.travelers = n
      next.travelerType = next.travelerType ?? 'family'
    }
  }

  if (!next.preferredAirline) {
    if (/\bsaudia\b|\bsaudi\s*air(?:lines?)?\b|\bsv\b/.test(lower) || /السعودية|سعوديه/.test(text)) {
      next.preferredAirline = 'SV'
    } else if (/\bemirates\b|\bek\b/.test(lower) || /الإمارات|الامارات/.test(text)) {
      next.preferredAirline = 'EK'
    } else if (/\bqatar\b|\bqr\b/.test(lower) || /القطرية/.test(text)) {
      next.preferredAirline = 'QR'
    }
  }

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
  // 1–2. Dialect detection + normalization (canonical text for extractors).
  const arabic = runBilamoArabicIntelligence(input.userText)
  const extractText = arabic.normalizedText || input.userText

  // 3. Intent + entity extraction on normalized text only.
  const extracted = extractFromUserText(extractText, input.memory.locale)
  const locale = extracted.locale || input.memory.locale

  let patch = enrichConsultantPatch(extractText, extracted.patch)
  patch = applyArabicHints(patch, arabic)

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
    arabic,
  }
}
