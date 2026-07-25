/**
 * Memory pipeline & component contracts — pure builders, no implementation.
 */

import type {
  ConversationMemoryContract,
  DestinationMemoryContract,
  DocumentMemoryContract,
  EntityMemoryContract,
  KnowledgeReferencesContract,
  MemoryAnalyticsContract,
  MemoryAuditTrailContract,
  MemoryConfidenceModelContract,
  MemoryContextContract,
  MemoryEngineContract,
  MemoryEventContract,
  MemoryLifecycleContract,
  MemoryLocale,
  MemoryMergeStrategyContract,
  MemoryPipelineContract,
  MemoryRankingContract,
  MemoryRetentionPolicyContract,
  MemoryRetrievalStrategyContract,
  MemorySessionContract,
  MemoryStateMachineContract,
  MemoryStoreContract,
  MemoryStoreKind,
  PreferenceMemoryContract,
  RelationshipMemoryContract,
  SessionMemoryContract,
  TravelerProfileMemoryContract,
  TripHistoryMemoryContract,
} from './types'
import {
  MEMORY_MODULE_HINTS,
  MEMORY_PIPELINE_STAGES,
  MEMORY_STATE_IDS,
  MEMORY_STORE_KINDS,
} from './types'

const ISO = '2026-07-25T00:00:00.000Z'

export function buildMemoryEngine(): MemoryEngineContract {
  return {
    kind: 'memory_engine',
    version: '6.5.0-memory-engine',
    execution: 'none',
  }
}

export function buildMemoryPipeline(): MemoryPipelineContract {
  return {
    kind: 'memory_pipeline',
    stages: MEMORY_PIPELINE_STAGES,
    execution: 'none',
  }
}

export function buildMemoryContext(
  sessionId: string,
  locale: MemoryLocale = 'ar',
): MemoryContextContract {
  return {
    kind: 'memory_context',
    sessionId,
    locale,
    queryHints: [],
    entityHints: [],
    moduleHints: MEMORY_MODULE_HINTS,
  }
}

export function buildMemorySession(
  sessionId: string,
  locale: MemoryLocale = 'ar',
): MemorySessionContract {
  return {
    kind: 'memory_session',
    sessionId,
    locale,
    openedAtIso: ISO,
    stateId: 'idle',
  }
}

export function buildMemoryStateMachine(): MemoryStateMachineContract {
  return {
    kind: 'memory_state_machine',
    current: 'idle',
    allowed: MEMORY_STATE_IDS,
    lastTransition: null,
    execution: 'none',
  }
}

export function buildMemoryStoreContract(
  storeKind: MemoryStoreKind,
): MemoryStoreContract {
  return {
    kind: 'memory_store_contract',
    storeKind,
    keys: [],
    persisted: false,
    execution: 'none',
  }
}

export function buildAllMemoryStoreContracts(): MemoryStoreContract[] {
  return MEMORY_STORE_KINDS.map(buildMemoryStoreContract)
}

export function buildConversationMemory(): ConversationMemoryContract {
  return {
    kind: 'conversation_memory',
    turnRefs: [],
    summaries: [],
    execution: 'none',
  }
}

export function buildSessionMemory(): SessionMemoryContract {
  return {
    kind: 'session_memory',
    slots: [],
    execution: 'none',
  }
}

export function buildTravelerProfileMemory(): TravelerProfileMemoryContract {
  return {
    kind: 'traveler_profile_memory',
    profileFields: [],
    execution: 'none',
  }
}

export function buildPreferenceMemory(): PreferenceMemoryContract {
  return {
    kind: 'preference_memory',
    preferences: [],
    execution: 'none',
  }
}

export function buildDestinationMemory(): DestinationMemoryContract {
  return {
    kind: 'destination_memory',
    destinations: [],
    execution: 'none',
  }
}

export function buildTripHistoryMemory(): TripHistoryMemoryContract {
  return {
    kind: 'trip_history_memory',
    tripRefs: [],
    execution: 'none',
  }
}

export function buildDocumentMemory(): DocumentMemoryContract {
  return {
    kind: 'document_memory',
    documentRefs: [],
    execution: 'none',
  }
}

export function buildRelationshipMemory(): RelationshipMemoryContract {
  return {
    kind: 'relationship_memory',
    relationships: [],
    execution: 'none',
  }
}

export function buildEntityMemory(): EntityMemoryContract {
  return {
    kind: 'entity_memory',
    entities: [],
    execution: 'none',
  }
}

export function buildKnowledgeReferences(): KnowledgeReferencesContract {
  return {
    kind: 'knowledge_references',
    refs: [],
    execution: 'none',
  }
}

export function buildMemoryRetrievalStrategy(): MemoryRetrievalStrategyContract {
  return {
    kind: 'memory_retrieval_strategy',
    strategyId: 'architecture_placeholder',
    steps: ['filter_by_session', 'filter_by_entity', 'order_by_recency_hint'],
    execution: 'none',
  }
}

export function buildMemoryRanking(): MemoryRankingContract {
  return {
    kind: 'memory_ranking',
    rankedIds: [],
    methodHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildMemoryMergeStrategy(): MemoryMergeStrategyContract {
  return {
    kind: 'memory_merge_strategy',
    strategyId: 'architecture_placeholder',
    rules: ['prefer_newer', 'dedupe_by_key'],
    execution: 'none',
  }
}

export function buildMemoryLifecycle(): MemoryLifecycleContract {
  return {
    kind: 'memory_lifecycle',
    phases: ['create', 'active', 'stale', 'archive', 'purge_hint'],
    currentPhase: 'create',
    execution: 'none',
  }
}

export function buildMemoryRetentionPolicy(): MemoryRetentionPolicyContract {
  return {
    kind: 'memory_retention_policy',
    policyId: 'architecture_placeholder',
    maxAgeHint: 'unspecified',
    maxItemsHint: 0,
    execution: 'none',
  }
}

export function buildMemoryConfidenceModel(
  score = 0.5,
): MemoryConfidenceModelContract {
  const band = score >= 0.75 ? 'high' : score >= 0.4 ? 'medium' : 'low'
  return {
    kind: 'memory_confidence_model',
    score,
    band,
    factors: ['architecture_placeholder'],
    execution: 'none',
  }
}

export function buildMemoryEvent(
  sessionId: string,
  eventKind: MemoryEventContract['eventKind'],
  payloadSummary: string,
): MemoryEventContract {
  return {
    kind: 'memory_event',
    eventId: `mevt-${eventKind}`,
    eventKind,
    sessionId,
    atIso: ISO,
    payloadSummary,
  }
}

export function buildMemoryAnalytics(sessionId: string): MemoryAnalyticsContract {
  return {
    kind: 'memory_analytics',
    sessionId,
    storeCount: MEMORY_STORE_KINDS.length,
    stageCount: MEMORY_PIPELINE_STAGES.length,
    averageConfidence: 0,
    exported: false,
  }
}

export function buildMemoryAuditTrail(): MemoryAuditTrailContract {
  return {
    kind: 'memory_audit_trail',
    entries: [
      {
        id: 'maudit-open',
        atIso: ISO,
        action: 'session_started',
        detail: 'architecture blueprint',
      },
    ],
    persisted: false,
  }
}
