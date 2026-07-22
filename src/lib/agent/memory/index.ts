/**
 * Sprint 112 — AI Memory & Personalization Engine barrel.
 *
 * Import via `../agent/memory/index` (or agent barrel) to avoid colliding with
 * legacy `src/lib/agent/memory.ts` conversation intake helpers.
 */

export {
  SPRINT112_MEMORY_ENGINE_VERSION,
  type TravelStyleKind,
  type CabinClassKind,
  type SeatTypeKind,
  type PreferencePolarity,
  type PreferenceKey,
  type PreferenceValue,
  type BudgetRangePreference,
  type LayoverPreference,
  type DepartureTimePreference,
  type MemoryTravelerProfile,
  type ExtractedPreferenceSignal,
  type ConversationTurnRecord,
  type SearchMemoryRecord,
  type RecommendationMemoryRecord,
  type ConversationMemoryState,
  type TravelHistorySummary,
  type ExplicitRequestOverrides,
  type MemoryCandidate,
  type PreferenceResolution,
  type PreferenceScoreBreakdown,
  type MemoryMetadata,
  type MemoryEngineInput,
  type MemoryEngineResult,
  type MemoryLogEntry,
  type MemoryStructuredLogger,
  createSilentMemoryLogger,
} from './types'

export {
  MEMORY_ENGINE_FEATURE_ID,
  isMemoryEngineEnabled,
} from './feature'

export {
  emptyMemoryTravelerProfile,
  syncTravelStyleFlags,
  topPreferredValues,
  hasTravelStyle,
  TravelerProfile,
  createTravelerProfileHelpers,
} from './TravelerProfile'

export {
  extractPreferencesFromText,
  extractPreferencesFromMessages,
  PreferenceExtractor,
  createPreferenceExtractor,
} from './PreferenceExtractor'

export {
  createPreferenceStore,
  getPreferenceStore,
  setPreferenceStore,
  resetPreferenceStore,
  getOrCreateMemoryProfile,
  type PreferenceStore,
} from './PreferenceStore'

export {
  applyPreferenceSignals,
  pruneObsoletePreferences,
  mergeProfiles,
  PreferenceUpdater,
  createPreferenceUpdater,
} from './PreferenceUpdater'

export {
  resolvePreferences,
  PreferenceResolver,
  createPreferenceResolver,
} from './PreferenceResolver'

export {
  emptyConversationMemory,
  createConversationMemoryStore,
  getConversationMemoryStore,
  resetConversationMemoryStore,
  getOrCreateConversationMemory,
  recordConversationTurn,
  recordSearch,
  recordRecommendationOutcome,
  ConversationMemory,
  createConversationMemory,
  type ConversationMemoryStore,
} from './ConversationMemory'

export {
  generateTravelHistory,
  TravelHistory,
  createTravelHistory,
} from './TravelHistory'

export {
  scoreCandidate,
  scoreCandidates,
  PreferenceScorer,
  createPreferenceScorer,
} from './PreferenceScorer'

export {
  buildMemoryMetadata,
  toConciergeMemoryHints,
  toResponseComposerMemoryNotes,
  emptyMemoryMetadata,
  summarizeMemoryResult,
  MemoryMetadataBuilder,
  createMemoryMetadataBuilder,
} from './MemoryMetadata'

export {
  MemoryRunner,
  createMemoryRunner,
  runMemoryEngine,
  resetMemoryEngineStores,
  type MemoryRunnerOptions,
} from './MemoryRunner'
