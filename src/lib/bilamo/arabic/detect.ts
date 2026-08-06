/**
 * Soft dialect detection from traveler utterance.
 * Unknown / low confidence → MSA. Never blocks understanding.
 */

import { BILAMO_DIALECT_CATALOG } from './dialects/catalog'
import type { BilamoArabicDialectId, BilamoDialectDetection } from './types'

const DETECT_THRESHOLD = 0.42
const ARABIC_RE = /[\u0600-\u06FF]/

export function detectBilamoArabicDialect(text: string): BilamoDialectDetection {
  const t = (text || '').trim()
  if (!t) {
    return { dialect: 'msa', confidence: 0, source: 'default_msa' }
  }
  if (!ARABIC_RE.test(t)) {
    return { dialect: 'msa', confidence: 0, source: 'latin' }
  }

  const scores = new Map<BilamoArabicDialectId, number>()
  for (const dialect of BILAMO_DIALECT_CATALOG) {
    for (const cue of dialect.cues) {
      if (cue.pattern.test(t)) {
        scores.set(dialect.id, (scores.get(dialect.id) || 0) + cue.weight)
      }
    }
  }

  let best: BilamoArabicDialectId = 'msa'
  let bestScore = 0
  for (const [id, score] of scores) {
    if (score > bestScore) {
      best = id
      bestScore = score
    }
  }

  if (bestScore < DETECT_THRESHOLD || best === 'msa') {
    return {
      dialect: 'msa',
      confidence: bestScore,
      source: 'default_msa',
    }
  }

  return {
    dialect: best,
    confidence: Math.min(1, bestScore),
    source: 'detected',
  }
}
