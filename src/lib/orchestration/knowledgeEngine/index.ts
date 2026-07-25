/**
 * Phase 6 Stage 6 — AI Knowledge Engine barrel.
 *
 * Architecture / contracts / types / blueprints only.
 * Gated by `brain.knowledge_engine` (default OFF).
 * No LLM, APIs, DB, vector search, Runtime, or production wiring.
 */

import { KNOWLEDGE_ENGINE_ISOLATION as KE_ISOLATION } from './types'
import {
  KNOWLEDGE_COVERAGE_DOMAINS,
  KNOWLEDGE_PIPELINE_STAGES,
} from './types'

export {
  BRAIN_KNOWLEDGE_ENGINE_FEATURE_ID,
  isBrainKnowledgeEngineEnabled,
  listKnowledgeRegistry,
  listKnowledgeModuleHints,
  listKnowledgeCoverageDomains,
  KnowledgeRegistry,
  KNOWLEDGE_REGISTRY,
} from './registry'

export type {
  KnowledgeLocale,
  KnowledgeStateId,
  KnowledgeEventKind,
  KnowledgeConfidenceBand,
  KnowledgeModuleHint,
  KnowledgePipelineStageId,
  KnowledgeCoverageDomain,
  KnowledgeProviderKind,
  KnowledgeEngineContract,
  KnowledgePipelineContract,
  KnowledgeRegistryEntry,
  KnowledgeProviderContract,
  KnowledgeSourceContract,
  KnowledgeDocumentContract,
  KnowledgeEntityContract,
  KnowledgeCategoryContract,
  KnowledgeGraphNodeContract,
  KnowledgeGraphEdgeContract,
  KnowledgeGraphContract,
  KnowledgeReferenceContract,
  KnowledgeContextContract,
  KnowledgeRetrievalContract,
  KnowledgeRankingContract,
  KnowledgeResolutionContract,
  KnowledgeValidationContract,
  KnowledgeFreshnessContract,
  KnowledgeConfidenceContract,
  KnowledgeProvenanceContract,
  KnowledgeCacheContract,
  KnowledgeEventContract,
  KnowledgeAnalyticsContract,
  KnowledgeAuditEntry,
  KnowledgeAuditTrailContract,
  KnowledgeStateTransition,
  KnowledgeStateMachineContract,
  KnowledgeEngineBlueprint,
} from './types'

export {
  KNOWLEDGE_ENGINE_ISOLATION,
  KNOWLEDGE_PIPELINE_STAGES,
  KNOWLEDGE_STATE_IDS,
  KNOWLEDGE_COVERAGE_DOMAINS,
  KNOWLEDGE_MODULE_HINTS,
} from './types'

export {
  buildKnowledgeEngine,
  buildKnowledgePipeline,
  buildKnowledgeProviders,
  buildKnowledgeSources,
  buildKnowledgeDocuments,
  buildKnowledgeEntities,
  buildKnowledgeCategories,
  buildKnowledgeGraph,
  buildKnowledgeReferences,
  buildKnowledgeContext,
  buildKnowledgeRetrieval,
  buildKnowledgeRanking,
  buildKnowledgeResolution,
  buildKnowledgeValidation,
  buildKnowledgeFreshness,
  buildKnowledgeConfidence,
  buildKnowledgeProvenance,
  buildKnowledgeCache,
  buildKnowledgeEvent,
  buildKnowledgeAnalytics,
  buildKnowledgeAuditTrail,
  buildKnowledgeStateMachine,
} from './pipelines'

export {
  KnowledgeEngine,
  buildKnowledgeEngineBlueprint,
  tryBuildKnowledgeEngineBlueprint,
  assertKnowledgeEngineIsolation,
} from './engine'
export type { BuildKnowledgeBlueprintOptions } from './engine'

export const KNOWLEDGE_ENGINE_ARCHITECTURE = {
  version: '6.6.0-knowledge-engine',
  featureId: 'brain.knowledge_engine' as const,
  architectureOnly: true,
  components: [
    'knowledge_engine',
    'knowledge_pipeline',
    'knowledge_registry',
    'knowledge_providers',
    'knowledge_sources',
    'knowledge_documents',
    'knowledge_entities',
    'knowledge_categories',
    'knowledge_graph',
    'knowledge_references',
    'knowledge_context',
    'knowledge_retrieval',
    'knowledge_ranking',
    'knowledge_resolution',
    'knowledge_validation',
    'knowledge_freshness',
    'knowledge_confidence',
    'knowledge_provenance',
    'knowledge_cache',
    'knowledge_events',
    'knowledge_analytics',
    'knowledge_audit_trail',
    'knowledge_state_machine',
  ] as const,
  pipelineStages: KNOWLEDGE_PIPELINE_STAGES,
  coverageDomains: KNOWLEDGE_COVERAGE_DOMAINS,
  ...KE_ISOLATION,
} as const
