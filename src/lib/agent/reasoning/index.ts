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
} from './preferenceBridge'
export { isTravelReasoningEnabled, isPreferenceMemoryEnabled } from './feature'
export { buildVisaGuidance } from './visaIntelligence'
export { buildTravelAdvisory } from './travelAdvisory'
export type { VisaGuidance } from './types'
