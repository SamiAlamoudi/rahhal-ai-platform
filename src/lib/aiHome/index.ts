/**
 * Sprint 16 — AI Home Experience (conversation-first).
 */

export type {
  HomeLocale,
  SuggestedPrompt,
  SuggestedPromptId,
  ContinueBookingModel,
  ContinueBookingStep,
  ContinueBookingStepId,
  TravelSmartCardModel,
  TravelCardKind,
  AiHomeGreeting,
  AiHomeModel,
} from './types'

export {
  buildAiHomeGreeting,
  formatGreetingLines,
  resolveDayPart,
} from './greeting'

export {
  SUGGESTED_PROMPTS,
  listSuggestedPrompts,
  getSuggestedPrompt,
  promptText,
  promptLabel,
} from './suggestedPrompts'

export {
  buildContinueBookingModel,
  findContinueBookingCandidate,
  resolveContinueResumeTarget,
  continueBookingHeadline,
} from './continueBooking'
export type { ResumeTarget } from './continueBooking'

export {
  buildTravelCards,
  upcomingTripCards,
  recentOrderCards,
  recommendedDestinationCards,
  travelInspirationCards,
  placeholderUtilityCards,
  cardTitle,
  cardSubtitle,
} from './travelCards'

export { buildAiHomeModel, conversationEntryPath } from './homeModel'
export type { BuildAiHomeModelInput } from './homeModel'

export {
  buildVoiceAwareChatNavigation,
  clearVoiceEntryHandoff,
  readVoiceEntryHandoff,
  resolveChatEntrySeed,
  writeVoiceEntryHandoff,
  VOICE_ENTRY_STORAGE_KEY,
} from './voiceEntryHandoff'
export type { VoiceEntryHandoff } from './voiceEntryHandoff'
