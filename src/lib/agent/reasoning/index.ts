/**
 * Sprint 45 — Autonomous Travel Reasoning Engine (production agent path).
 */

export type {
  ClimateBand,
  VisaEase,
  DestinationClimateProfile,
  DestinationCandidate,
  TravelReasoningResult,
  TravelReasoningInput,
  TravelReasoningSnapshot,
} from './types'

export { DESTINATION_CATALOG, findDestinationProfile } from './destinationCatalog'
export {
  detectOpenEndedDestination,
  climateFromPreference,
} from './openEndedDetector'
export {
  runTravelReasoning,
  toReasoningSnapshot,
  applyReasoningToRequirements,
  matchDestinationSelection,
} from './travelReasoningEngine'
export { formatReasoningReply } from './formatReasoningReply'
export {
  seedRequirementsFromPreferences,
  learnPreferencesFromRequirements,
  applyProfileToRequirements,
  isPreferenceMemoryEnabled,
} from './preferenceBridge'
export { isTravelReasoningEnabled } from './feature'
