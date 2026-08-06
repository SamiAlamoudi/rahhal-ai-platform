/**
 * Arabic Language Intelligence pipeline (before entity extraction):
 * Speech/Text → Dialect Detection → Normalization → (Intent/Entity via Bilamo)
 */

import { detectBilamoArabicDialect } from './detect'
import { normalizeArabicForBilamo } from './normalize'
import type { BilamoArabicNormalizeResult } from './types'

/**
 * Run dialect detection + normalization.
 * Display/UI must keep `originalText`; extractors use `normalizedText`.
 */
export function runBilamoArabicIntelligence(userText: string): BilamoArabicNormalizeResult {
  const detection = detectBilamoArabicDialect(userText)
  return normalizeArabicForBilamo(userText, detection)
}
