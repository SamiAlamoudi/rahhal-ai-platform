/**
 * Sprint 44 — ChatGPT-like conversation experience public surface.
 */

export type {
  ChatGptIntent,
  ChatGptExperienceState,
  PlanStepId,
  ResponsePlan,
  ToolDecision,
  MemorySnapshot,
  ExperienceTurnContext,
  ExperienceTurnResult,
  SessionUiRecovery,
} from './types'

export { EXPERIENCE_STATE_LABELS } from './types'
export { CHATGPT_EXPERIENCE_FEATURE_ID, isChatGptExperienceEnabled } from './feature'
export { createMemoryManager, type MemoryManagerHandle } from './memoryManager'
export { classifyChatIntent, type IntentUnderstandingResult } from './intentUnderstanding'
export { decideTools, buildResponsePlan } from './responsePlanner'
export {
  composeNaturalReply,
  smartFollowUp,
  naturalToolFailureMessage,
} from './naturalLanguage'
export {
  createExperienceStateMachine,
  type ExperienceStateMachine,
} from './conversationStates'
export {
  readSessionUiRecovery,
  writeSessionUiRecovery,
  togglePinnedConversation,
} from './contextRecovery'
export { withToolRetry } from './errorRecovery'
export {
  createChatGptExperienceOrchestrator,
  type ChatGptExperienceOrchestrator,
} from './experienceOrchestrator'
export { createChatGptExperienceProvider } from './chatgptChatProvider'
export {
  logExperience,
  createTimingTracker,
  type ExperienceLogStage,
} from './experienceLogger'
