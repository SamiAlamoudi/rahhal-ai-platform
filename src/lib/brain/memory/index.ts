/**
 * Sprint 28 — Conversation Memory & Context Engine public surface.
 */

export type {
  ExtendedMemorySlot,
  SeatPreference,
  MealPreference,
  VisaStatus,
  FamilyMember,
  PassportNationalitySlot,
  LoyaltyProgramEntry,
  ConversationMemoryExtensions,
  EnrichedConversationMemory,
  TravelPreferenceProfile,
  ShortTermMemoryState,
  ConversationSummary,
  AssembledContext,
  MemoryExtractionResult,
  MemoryEngineTurnResult,
  MemoryExpirationPolicy,
} from './types'

export { DEFAULT_MEMORY_EXPIRATION_POLICY } from './types'

export {
  emptyPassportNationality,
  maskSensitiveValue,
  redactLoyaltyForPublic,
  sanitizeMemoryForPublic,
  sanitizeProfileForPublic,
  sanitizeMetadata,
  toLongTermSafeProfile,
} from './privacy'

export {
  applySensitiveExpiration,
  expiryFromNow,
  isExpired,
  resolvePolicy,
} from './expiration'

export {
  emptyExtensions,
  enrichMemory,
  createEmptyEnrichedMemory,
  cloneEnrichedMemory,
  applyEnrichedPatch,
  ensureEnriched,
  isEnrichedMemory,
} from './enrichedMemory'

export { MemoryExtractor } from './memoryExtractor'

export {
  ConversationMemoryService,
  getConversationMemoryService,
  resetConversationMemoryService,
} from './conversationMemoryService'
export type {
  ConversationMemoryServiceOptions,
  ConversationMemoryServiceHandle,
} from './conversationMemoryService'

export {
  UserPreferenceStore,
  emptyTravelPreferenceProfile,
  getUserPreferenceStore,
  resetUserPreferenceStore,
} from './userPreferenceStore'
export type {
  UserPreferenceStoreOptions,
  UserPreferenceStoreHandle,
} from './userPreferenceStore'

export { ConversationSummarizer } from './conversationSummarizer'
export type {
  ConversationSummarizerOptions,
  ConversationSummarizerHandle,
} from './conversationSummarizer'

export {
  ContextAssembler,
  mergeLongTermIntoSession,
} from './contextAssembler'
export type { ContextAssemblerInput } from './contextAssembler'

export {
  detectMissingPreferenceSlots,
  buildFollowUpQuestions,
  promptForExtendedSlot,
} from './followUpQuestions'

export { isBrainContextMemoryEnabled } from './feature'

export {
  MemoryContextEngine,
  getOrCreateMemoryContextEngine,
  resetMemoryContextEngine,
  getSharedMemoryServices,
} from './memoryContextEngine'
export type {
  MemoryContextEngineOptions,
  MemoryContextEngineHandle,
} from './memoryContextEngine'
