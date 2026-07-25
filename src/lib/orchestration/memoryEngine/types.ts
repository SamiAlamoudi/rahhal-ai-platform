/**
 * Phase 6 Stage 5 — AI Memory Engine contracts.
 * Architecture / interfaces / types / blueprints only.
 * No LLM, embeddings, vector DB, storage, or Runtime.
 */

export type MemoryLocale = 'ar' | 'en'

export type MemoryStateId =
  | 'idle'
  | 'collecting'
  | 'writing'
  | 'retrieving'
  | 'ranking'
  | 'merging'
  | 'retaining'
  | 'ready'
  | 'closed'

export type MemoryEventKind =
  | 'session_started'
  | 'context_attached'
  | 'memory_written'
  | 'memory_retrieved'
  | 'memory_ranked'
  | 'memory_merged'
  | 'lifecycle_advanced'
  | 'retention_applied'
  | 'confidence_scored'
  | 'audit_appended'
  | 'state_transition'
  | 'session_ended'

export type MemoryConfidenceBand = 'low' | 'medium' | 'high'

export type MemoryModuleHint =
  | 'memory_center'
  | 'traveler_profile'
  | 'conversation_center'
  | 'decision_center'
  | 'insights_center'
  | 'booking_hub'
  | 'travel_workspace'
  | 'journey_timeline'

export type MemoryPipelineStageId =
  | 'attach_context'
  | 'read_session'
  | 'read_conversation'
  | 'read_profile'
  | 'read_preferences'
  | 'read_destinations'
  | 'read_trip_history'
  | 'read_documents'
  | 'read_relationships'
  | 'read_entities'
  | 'resolve_knowledge_refs'
  | 'apply_retrieval_strategy'
  | 'rank_memories'
  | 'merge_memories'
  | 'apply_lifecycle'
  | 'apply_retention'
  | 'score_confidence'
  | 'append_audit'

export type MemoryStoreKind =
  | 'conversation'
  | 'session'
  | 'traveler_profile'
  | 'preference'
  | 'destination'
  | 'trip_history'
  | 'document'
  | 'relationship'
  | 'entity'
  | 'knowledge_reference'

export interface MemoryEngineContract {
  kind: 'memory_engine'
  version: '6.5.0-memory-engine'
  execution: 'none'
}

export interface MemoryPipelineContract {
  kind: 'memory_pipeline'
  stages: readonly MemoryPipelineStageId[]
  execution: 'none'
}

export interface MemoryContextContract {
  kind: 'memory_context'
  sessionId: string
  locale: MemoryLocale
  queryHints: readonly string[]
  entityHints: readonly string[]
  moduleHints: readonly MemoryModuleHint[]
}

export interface MemorySessionContract {
  kind: 'memory_session'
  sessionId: string
  locale: MemoryLocale
  openedAtIso: string
  stateId: MemoryStateId
}

export interface MemoryRegistryEntry {
  id: string
  storeKind: MemoryStoreKind
  moduleHints: readonly MemoryModuleHint[]
}

export interface MemoryEventContract {
  kind: 'memory_event'
  eventId: string
  eventKind: MemoryEventKind
  sessionId: string
  atIso: string
  payloadSummary: string
}

export interface MemoryStateTransition {
  from: MemoryStateId
  to: MemoryStateId
  reason: string
}

export interface MemoryStateMachineContract {
  kind: 'memory_state_machine'
  current: MemoryStateId
  allowed: readonly MemoryStateId[]
  lastTransition: MemoryStateTransition | null
  execution: 'none'
}

export interface MemoryStoreContract {
  kind: 'memory_store_contract'
  storeKind: MemoryStoreKind
  keys: readonly string[]
  /** Never backed by a real store. */
  persisted: false
  execution: 'none'
}

export interface ConversationMemoryContract {
  kind: 'conversation_memory'
  turnRefs: readonly string[]
  summaries: readonly string[]
  execution: 'none'
}

export interface SessionMemoryContract {
  kind: 'session_memory'
  slots: readonly { key: string; valueHint: string }[]
  execution: 'none'
}

export interface TravelerProfileMemoryContract {
  kind: 'traveler_profile_memory'
  profileFields: readonly string[]
  execution: 'none'
}

export interface PreferenceMemoryContract {
  kind: 'preference_memory'
  preferences: readonly string[]
  execution: 'none'
}

export interface DestinationMemoryContract {
  kind: 'destination_memory'
  destinations: readonly string[]
  execution: 'none'
}

export interface TripHistoryMemoryContract {
  kind: 'trip_history_memory'
  tripRefs: readonly string[]
  execution: 'none'
}

export interface DocumentMemoryContract {
  kind: 'document_memory'
  documentRefs: readonly string[]
  execution: 'none'
}

export interface RelationshipMemoryContract {
  kind: 'relationship_memory'
  relationships: readonly { id: string; label: string }[]
  execution: 'none'
}

export interface EntityMemoryContract {
  kind: 'entity_memory'
  entities: readonly { id: string; typeHint: string; label: string }[]
  execution: 'none'
}

export interface KnowledgeReferencesContract {
  kind: 'knowledge_references'
  refs: readonly { id: string; sourceHint: string }[]
  execution: 'none'
}

export interface MemoryRetrievalStrategyContract {
  kind: 'memory_retrieval_strategy'
  strategyId: string
  steps: readonly string[]
  execution: 'none'
}

export interface MemoryRankingContract {
  kind: 'memory_ranking'
  rankedIds: readonly string[]
  methodHint: string
  execution: 'none'
}

export interface MemoryMergeStrategyContract {
  kind: 'memory_merge_strategy'
  strategyId: string
  rules: readonly string[]
  execution: 'none'
}

export interface MemoryLifecycleContract {
  kind: 'memory_lifecycle'
  phases: readonly string[]
  currentPhase: string
  execution: 'none'
}

export interface MemoryRetentionPolicyContract {
  kind: 'memory_retention_policy'
  policyId: string
  maxAgeHint: string
  maxItemsHint: number
  execution: 'none'
}

export interface MemoryConfidenceModelContract {
  kind: 'memory_confidence_model'
  score: number
  band: MemoryConfidenceBand
  factors: readonly string[]
  execution: 'none'
}

export interface MemoryAuditEntry {
  id: string
  atIso: string
  action: string
  detail: string
}

export interface MemoryAuditTrailContract {
  kind: 'memory_audit_trail'
  entries: readonly MemoryAuditEntry[]
  persisted: false
}

export interface MemoryAnalyticsContract {
  kind: 'memory_analytics'
  sessionId: string
  storeCount: number
  stageCount: number
  averageConfidence: number
  exported: false
}

export interface MemoryEngineBlueprint {
  version: '6.5.0-memory-engine'
  featureId: 'brain.memory_engine'
  architectureOnly: true
  engine: MemoryEngineContract
  pipeline: MemoryPipelineContract
  memoryContext: MemoryContextContract
  memorySession: MemorySessionContract
  registry: readonly MemoryRegistryEntry[]
  events: readonly MemoryEventContract[]
  stateMachine: MemoryStateMachineContract
  storeContracts: readonly MemoryStoreContract[]
  conversationMemory: ConversationMemoryContract
  sessionMemory: SessionMemoryContract
  travelerProfileMemory: TravelerProfileMemoryContract
  preferenceMemory: PreferenceMemoryContract
  destinationMemory: DestinationMemoryContract
  tripHistoryMemory: TripHistoryMemoryContract
  documentMemory: DocumentMemoryContract
  relationshipMemory: RelationshipMemoryContract
  entityMemory: EntityMemoryContract
  knowledgeReferences: KnowledgeReferencesContract
  retrievalStrategy: MemoryRetrievalStrategyContract
  ranking: MemoryRankingContract
  mergeStrategy: MemoryMergeStrategyContract
  lifecycle: MemoryLifecycleContract
  retentionPolicy: MemoryRetentionPolicyContract
  confidence: MemoryConfidenceModelContract
  auditTrail: MemoryAuditTrailContract
  analytics: MemoryAnalyticsContract
}

export const MEMORY_ENGINE_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoOpenAi: false,
  wiredIntoClaude: false,
  wiredIntoGemini: false,
  wiredIntoLlms: false,
  wiredIntoEmbeddings: false,
  wiredIntoVectorSearch: false,
  wiredIntoVectorDatabase: false,
  wiredIntoDatabase: false,
  wiredIntoSupabase: false,
  wiredIntoFirebase: false,
  wiredIntoRedis: false,
  wiredIntoStorage: false,
  wiredIntoRuntime: false,
  memoryImplementation: false,
  businessLogic: false,
} as const

export const MEMORY_PIPELINE_STAGES: readonly MemoryPipelineStageId[] = [
  'attach_context',
  'read_session',
  'read_conversation',
  'read_profile',
  'read_preferences',
  'read_destinations',
  'read_trip_history',
  'read_documents',
  'read_relationships',
  'read_entities',
  'resolve_knowledge_refs',
  'apply_retrieval_strategy',
  'rank_memories',
  'merge_memories',
  'apply_lifecycle',
  'apply_retention',
  'score_confidence',
  'append_audit',
] as const

export const MEMORY_STATE_IDS: readonly MemoryStateId[] = [
  'idle',
  'collecting',
  'writing',
  'retrieving',
  'ranking',
  'merging',
  'retaining',
  'ready',
  'closed',
] as const

export const MEMORY_STORE_KINDS: readonly MemoryStoreKind[] = [
  'conversation',
  'session',
  'traveler_profile',
  'preference',
  'destination',
  'trip_history',
  'document',
  'relationship',
  'entity',
  'knowledge_reference',
] as const

export const MEMORY_MODULE_HINTS: readonly MemoryModuleHint[] = [
  'memory_center',
  'traveler_profile',
  'conversation_center',
  'decision_center',
  'insights_center',
  'booking_hub',
  'travel_workspace',
  'journey_timeline',
] as const
