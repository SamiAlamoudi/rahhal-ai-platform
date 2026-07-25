/**
 * Memory Engine facade — builds architecture blueprints only.
 * Never stores, embeds, retrieves, or syncs memory.
 */

import { listMemoryRegistry } from './registry'
import { isBrainMemoryEngineEnabled } from './registry'
import {
  buildAllMemoryStoreContracts,
  buildConversationMemory,
  buildDestinationMemory,
  buildDocumentMemory,
  buildEntityMemory,
  buildKnowledgeReferences,
  buildMemoryAnalytics,
  buildMemoryAuditTrail,
  buildMemoryConfidenceModel,
  buildMemoryContext,
  buildMemoryEngine,
  buildMemoryEvent,
  buildMemoryLifecycle,
  buildMemoryMergeStrategy,
  buildMemoryPipeline,
  buildMemoryRanking,
  buildMemoryRetentionPolicy,
  buildMemoryRetrievalStrategy,
  buildMemorySession,
  buildMemoryStateMachine,
  buildPreferenceMemory,
  buildRelationshipMemory,
  buildSessionMemory,
  buildTravelerProfileMemory,
  buildTripHistoryMemory,
} from './pipelines'
import type { MemoryEngineBlueprint, MemoryLocale } from './types'
import { MEMORY_ENGINE_ISOLATION } from './types'

export interface BuildMemoryBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: MemoryLocale
}

export function buildMemoryEngineBlueprint(
  options: BuildMemoryBlueprintOptions = {},
): MemoryEngineBlueprint {
  const sessionId = options.sessionId ?? 'memory-session-architecture'
  const locale = options.locale ?? 'ar'

  return {
    version: '6.5.0-memory-engine',
    featureId: 'brain.memory_engine',
    architectureOnly: true,
    engine: buildMemoryEngine(),
    pipeline: buildMemoryPipeline(),
    memoryContext: buildMemoryContext(sessionId, locale),
    memorySession: buildMemorySession(sessionId, locale),
    registry: listMemoryRegistry(),
    events: [
      buildMemoryEvent(sessionId, 'session_started', 'architecture blueprint'),
      buildMemoryEvent(sessionId, 'context_attached', 'empty context'),
    ],
    stateMachine: buildMemoryStateMachine(),
    storeContracts: buildAllMemoryStoreContracts(),
    conversationMemory: buildConversationMemory(),
    sessionMemory: buildSessionMemory(),
    travelerProfileMemory: buildTravelerProfileMemory(),
    preferenceMemory: buildPreferenceMemory(),
    destinationMemory: buildDestinationMemory(),
    tripHistoryMemory: buildTripHistoryMemory(),
    documentMemory: buildDocumentMemory(),
    relationshipMemory: buildRelationshipMemory(),
    entityMemory: buildEntityMemory(),
    knowledgeReferences: buildKnowledgeReferences(),
    retrievalStrategy: buildMemoryRetrievalStrategy(),
    ranking: buildMemoryRanking(),
    mergeStrategy: buildMemoryMergeStrategy(),
    lifecycle: buildMemoryLifecycle(),
    retentionPolicy: buildMemoryRetentionPolicy(),
    confidence: buildMemoryConfidenceModel(0.5),
    auditTrail: buildMemoryAuditTrail(),
    analytics: buildMemoryAnalytics(sessionId),
  }
}

export function tryBuildMemoryEngineBlueprint(
  options: BuildMemoryBlueprintOptions = {},
): MemoryEngineBlueprint | null {
  if (!isBrainMemoryEngineEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildMemoryEngineBlueprint(options)
}

export function assertMemoryEngineIsolation(): typeof MEMORY_ENGINE_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...MEMORY_ENGINE_ISOLATION,
    architectureOnly: true,
    registrySize: listMemoryRegistry().length,
  }
}

export const MemoryEngine = {
  buildBlueprint: buildMemoryEngineBlueprint,
  tryBuildBlueprint: tryBuildMemoryEngineBlueprint,
  assertIsolation: assertMemoryEngineIsolation,
}
