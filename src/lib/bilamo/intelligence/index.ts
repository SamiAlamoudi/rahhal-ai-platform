/**
 * Bilamo Intelligence Layer — public exports.
 */

export { BILAMO_INTELLIGENCE_VERSION } from './types'
export type {
  BilamoConsultantMemory,
  BilamoContextIntel,
  BilamoFlightOption,
  BilamoHardSlot,
  BilamoHotelOption,
  BilamoPhase,
  BilamoSearchBundle,
  BilamoTurnInput,
  BilamoTurnResult,
} from './types'

export {
  BILAMO_INTELLIGENCE_FEATURE_ID,
  BILAMO_INTELLIGENCE_FEATURE_VERSION,
  isBilamoIntelligenceEnabled,
} from './feature'

export {
  emptyBilamoMemory,
  hydrateBilamoMemory,
  rememberAsked,
  applyPreferencesToRequirements,
  syncPreferencesFromRequirements,
} from './smartMemory'

export { extractBilamoEntities } from './entityExtraction'

// Arabic Language Intelligence (dialect → canonical) — before entity extraction.
export {
  BILAMO_ARABIC_INTELLIGENCE_VERSION,
  BILAMO_DIALECT_CATALOG,
  listBilamoDialectIds,
  detectBilamoArabicDialect,
  runBilamoArabicIntelligence,
  registerBilamoDialect,
} from '../arabic'
export type {
  BilamoArabicDialectId,
  BilamoArabicNormalizeResult,
  BilamoDialectDetection,
} from '../arabic'
export {
  nextMinimumQuestion,
  canSearch,
  clarificationPrompt,
  acknowledgeAndAsk,
} from './clarification'
export { runBilamoSearchOrchestrator } from './searchOrchestrator'
export {
  composeRecommendation,
  composeGreeting,
  streamConsultantText,
} from './consultantComposer'
export {
  runBilamoIntelligenceTurn,
  bilamoResultToTravelAgentTurn,
  emptySessionMemory,
} from './conversationManager'
