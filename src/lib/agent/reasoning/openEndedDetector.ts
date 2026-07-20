/**
 * Detect open-ended destination discovery ("somewhere cold…") vs named places.
 */

import type { ClimateBand } from './types'

export interface OpenEndedDetection {
  isOpenEnded: boolean
  climateHint: ClimateBand | null
  /** User asked for alternatives / surprise me. */
  wantsAlternatives: boolean
  /** Confidence that destination should stay flexible. */
  confidence: number
}

const OPEN_ENDED_PATTERNS: RegExp[] = [
  /\bsomewhere\b/,
  /\banywhere\b/,
  /\bany\s+place\b/,
  /\bany\s+destination\b/,
  /\bsuggest\s+(?:a\s+)?(?:place|destination|city|country)\b/,
  /\bwhere\s+(?:should|can|could)\s+i\s+go\b/,
  /\brecommend\s+(?:a\s+)?(?:place|destination|trip)\b/,
  /\bsurprise\s+me\b/,
  /مكان\s*(?:بارد|حار|دافئ|معتدل|ما)?/,
  /أي\s*مكان/,
  /وين\s*(?:أروح|اروح|أسافر|اسافر)/,
  /أين\s*(?:أذهب|اذهب|أسافر|اسافر)/,
  /اقترح\s*(?:عليّ|علي|لي)?\s*(?:وجهة|مكان|رحلة)?/,
  /رشّح|رشح/,
  /فاجأني|فاجيني/,
]

const CLIMATE_FROM_OPEN: Array<{ re: RegExp; band: ClimateBand }> = [
  { re: /\bcold\b|بارد|برودة|ثلج|snow/, band: 'cold' },
  { re: /\bcool\b|مائل للبرودة|منعش/, band: 'cool' },
  { re: /\bmild\b|معتدل/, band: 'mild' },
  { re: /\bhot\b|حار/, band: 'hot' },
  { re: /\bwarm\b|دافئ/, band: 'warm' },
  { re: /\bdry\b|جاف/, band: 'dry' },
  { re: /\brainy\b|ممطر/, band: 'rainy' },
]

export function detectOpenEndedDestination(
  text: string,
  hasNamedDestination: boolean,
): OpenEndedDetection {
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()

  let climateHint: ClimateBand | null = null
  for (const row of CLIMATE_FROM_OPEN) {
    if (row.re.test(lower) || row.re.test(trimmed)) {
      climateHint = row.band
      break
    }
  }

  const patternHit = OPEN_ENDED_PATTERNS.some((re) => re.test(lower) || re.test(trimmed))
  const wantsAlternatives = /\balternative|options|خيارات|بدائل|غير كذا/.test(lower)
    || /بدائل|خيارات/.test(trimmed)
    || /\bsurprise\b|فاجأن/.test(lower + trimmed)

  // Weather preference without a named place can support discovery, but alone is weak.
  const weatherWithoutPlace = Boolean(climateHint) && !hasNamedDestination

  const isOpenEnded = (!hasNamedDestination && patternHit)
    || wantsAlternatives
    || (!hasNamedDestination && weatherWithoutPlace && patternHit)

  let confidence = 0
  if (patternHit) confidence += 0.55
  if (weatherWithoutPlace) confidence += 0.25
  if (wantsAlternatives) confidence += 0.2
  if (hasNamedDestination && !wantsAlternatives) confidence = 0

  return {
    isOpenEnded: isOpenEnded && confidence >= 0.5,
    climateHint,
    wantsAlternatives,
    confidence: Math.min(1, confidence),
  }
}

/** Map user weatherPreference strings onto climate bands. */
export function climateFromPreference(value: string | null | undefined): ClimateBand | null {
  if (!value) return null
  const key = value.trim().toLowerCase()
  if (key === 'cold' || key === 'cool') return key as ClimateBand
  if (key === 'mild' || key === 'warm' || key === 'hot' || key === 'dry' || key === 'rainy' || key === 'flexible') {
    return key as ClimateBand
  }
  if (/بارد|cool|cold/.test(key)) return 'cool'
  if (/حار|hot/.test(key)) return 'hot'
  if (/دافئ|warm/.test(key)) return 'warm'
  if (/معتدل|mild/.test(key)) return 'mild'
  return null
}
