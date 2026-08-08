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
export {
  nextMinimumQuestion,
  canSearch,
  clarificationPrompt,
  acknowledgeAndAsk,
  withSearchDefaults,
} from './clarification'
export { runBilamoSearchOrchestrator } from './searchOrchestrator'
export {
  validateFlightRoute,
  isValidRenderableFlight,
  canonicalizeAirportCode,
} from './flightRouteValidation'
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
