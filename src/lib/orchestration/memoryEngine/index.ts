/**
 * Phase 6 Stage 5 — AI Memory Engine barrel.
 *
 * Architecture / contracts / types / blueprints only.
 * Gated by `brain.memory_engine` (default OFF).
 * No embeddings, vector DB, storage, Runtime, or production wiring.
 */

import { MEMORY_ENGINE_ISOLATION as ME_ISOLATION } from './types'
import { MEMORY_PIPELINE_STAGES, MEMORY_STORE_KINDS } from './types'

export {
  BRAIN_MEMORY_ENGINE_FEATURE_ID,
  isBrainMemoryEngineEnabled,
  listMemoryRegistry,
  listMemoryModuleHints,
  MemoryRegistry,
  MEMORY_REGISTRY,
} from './registry'

export type {
  MemoryLocale,
  MemoryStateId,
  MemoryEventKind,
  MemoryConfidenceBand,
  MemoryModuleHint,
  MemoryPipelineStageId,
  MemoryStoreKind,
  MemoryEngineContract,
  MemoryPipelineContract,
  MemoryContextContract,
  MemorySessionContract,
  MemoryRegistryEntry,
  MemoryEventContract,
  MemoryStateTransition,
  MemoryStateMachineContract,
  MemoryStoreContract,
  ConversationMemoryContract,
  SessionMemoryContract,
  TravelerProfileMemoryContract,
  PreferenceMemoryContract,
  DestinationMemoryContract,
  TripHistoryMemoryContract,
  DocumentMemoryContract,
  RelationshipMemoryContract,
  EntityMemoryContract,
  KnowledgeReferencesContract,
  MemoryRetrievalStrategyContract,
  MemoryRankingContract,
  MemoryMergeStrategyContract,
  MemoryLifecycleContract,
  MemoryRetentionPolicyContract,
  MemoryConfidenceModelContract,
  MemoryAuditEntry,
  MemoryAuditTrailContract,
  MemoryAnalyticsContract,
  MemoryEngineBlueprint,
} from './types'

export {
  MEMORY_ENGINE_ISOLATION,
  MEMORY_PIPELINE_STAGES,
  MEMORY_STATE_IDS,
  MEMORY_STORE_KINDS,
  MEMORY_MODULE_HINTS,
} from './types'

export {
  buildMemoryEngine,
  buildMemoryPipeline,
  buildMemoryContext,
  buildMemorySession,
  buildMemoryStateMachine,
  buildMemoryStoreContract,
  buildAllMemoryStoreContracts,
  buildConversationMemory,
  buildSessionMemory,
  buildTravelerProfileMemory,
  buildPreferenceMemory,
  buildDestinationMemory,
  buildTripHistoryMemory,
  buildDocumentMemory,
  buildRelationshipMemory,
  buildEntityMemory,
  buildKnowledgeReferences,
  buildMemoryRetrievalStrategy,
  buildMemoryRanking,
  buildMemoryMergeStrategy,
  buildMemoryLifecycle,
  buildMemoryRetentionPolicy,
  buildMemoryConfidenceModel,
  buildMemoryEvent,
  buildMemoryAnalytics,
  buildMemoryAuditTrail,
} from './pipelines'

export {
  MemoryEngine,
  buildMemoryEngineBlueprint,
  tryBuildMemoryEngineBlueprint,
  assertMemoryEngineIsolation,
} from './engine'
export type { BuildMemoryBlueprintOptions } from './engine'

export const MEMORY_ENGINE_ARCHITECTURE = {
  version: '6.5.0-memory-engine',
  featureId: 'brain.memory_engine' as const,
  architectureOnly: true,
  components: [
    'memory_engine',
    'memory_pipeline',
    'memory_context',
    'memory_session',
    'memory_registry',
    'memory_events',
    'memory_state_machine',
    'memory_store_contracts',
    'conversation_memory',
    'session_memory',
    'traveler_profile_memory',
    'preference_memory',
    'destination_memory',
    'trip_history_memory',
    'document_memory',
    'relationship_memory',
    'entity_memory',
    'knowledge_references',
    'memory_retrieval_strategy',
    'memory_ranking',
    'memory_merge_strategy',
    'memory_lifecycle',
    'memory_retention_policy',
    'memory_confidence_model',
    'memory_audit_trail',
    'memory_analytics',
  ] as const,
  pipelineStages: MEMORY_PIPELINE_STAGES,
  storeKinds: MEMORY_STORE_KINDS,
  ...ME_ISOLATION,
} as const
