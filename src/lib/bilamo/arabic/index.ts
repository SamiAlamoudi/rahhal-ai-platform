/**
 * Bilamo Arabic Language Intelligence — public API.
 * Extensible dialect catalog; Intelligence Layer consumes only normalized text.
 */

export {
  BILAMO_ARABIC_INTELLIGENCE_VERSION,
} from './types'
export type {
  BilamoArabicDialectId,
  BilamoArabicNormalizeResult,
  BilamoDialectDetection,
  BilamoDialectDefinition,
  DialectRewriteRule,
} from './types'

export {
  BILAMO_DIALECT_CATALOG,
  listBilamoDialectIds,
  getBilamoDialect,
  isBilamoArabicDialectId,
  registerBilamoDialect,
} from './dialects/catalog'

export { detectBilamoArabicDialect } from './detect'
export { normalizeArabicForBilamo } from './normalize'
export { runBilamoArabicIntelligence } from './pipeline'
