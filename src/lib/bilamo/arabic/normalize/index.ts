/**
 * Compose Arabic normalization passes into one canonical string.
 */

import { normalizeRelativeDates } from './dates'
import { normalizeIntentPhrases } from './intent'
import { normalizePlaceNames } from './places'
import { prepArabicText } from './textPrep'
import { normalizeTravelerPhrases } from './travelers'
import type { BilamoArabicNormalizeResult } from '../types'
import { BILAMO_ARABIC_INTELLIGENCE_VERSION } from '../types'
import type { BilamoDialectDetection } from '../types'

export function normalizeArabicForBilamo(
  originalText: string,
  detection: BilamoDialectDetection,
): BilamoArabicNormalizeResult {
  const prep = prepArabicText(originalText)
  let text = prep.text

  // Travelers before intent so phrases like "بدنا اثنين" are not flattened to "أريد".
  const travelers = normalizeTravelerPhrases(text)
  text = travelers.text

  const intent = normalizeIntentPhrases(text)
  text = intent.text

  const dates = normalizeRelativeDates(text)
  text = dates.text

  const places = normalizePlaceNames(text)
  text = places.text

  return {
    version: BILAMO_ARABIC_INTELLIGENCE_VERSION,
    originalText,
    normalizedText: text.replace(/\s+/g, ' ').trim(),
    detection,
    applied: {
      textPrep: prep.changed,
      intent: intent.changed,
      travelers: travelers.changed,
      dates: dates.changed,
      places: places.changed,
    },
    hints: {
      travelIntent: intent.travelIntent,
      travelers: travelers.hints.travelers,
      travelerType: travelers.hints.travelerType,
      children: travelers.hints.children,
      infants: travelers.hints.infants,
      relativeDateHint: dates.relativeDateHint,
    },
  }
}
