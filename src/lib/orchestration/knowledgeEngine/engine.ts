/**
 * Knowledge Engine facade — builds architecture blueprints only.
 * Never retrieves, searches, or calls providers.
 */

import { listKnowledgeRegistry } from './registry'
import { isBrainKnowledgeEngineEnabled } from './registry'
import {
  buildKnowledgeAnalytics,
  buildKnowledgeAuditTrail,
  buildKnowledgeCache,
  buildKnowledgeCategories,
  buildKnowledgeConfidence,
  buildKnowledgeContext,
  buildKnowledgeDocuments,
  buildKnowledgeEngine,
  buildKnowledgeEntities,
  buildKnowledgeEvent,
  buildKnowledgeFreshness,
  buildKnowledgeGraph,
  buildKnowledgePipeline,
  buildKnowledgeProvenance,
  buildKnowledgeProviders,
  buildKnowledgeRanking,
  buildKnowledgeReferences,
  buildKnowledgeResolution,
  buildKnowledgeRetrieval,
  buildKnowledgeSources,
  buildKnowledgeStateMachine,
  buildKnowledgeValidation,
} from './pipelines'
import type { KnowledgeEngineBlueprint, KnowledgeLocale } from './types'
import {
  KNOWLEDGE_COVERAGE_DOMAINS,
  KNOWLEDGE_ENGINE_ISOLATION,
} from './types'

export interface BuildKnowledgeBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: KnowledgeLocale
}

export function buildKnowledgeEngineBlueprint(
  options: BuildKnowledgeBlueprintOptions = {},
): KnowledgeEngineBlueprint {
  const sessionId = options.sessionId ?? 'knowledge-session-architecture'
  const locale = options.locale ?? 'ar'
  const providers = buildKnowledgeProviders()

  return {
    version: '6.6.0-knowledge-engine',
    featureId: 'brain.knowledge_engine',
    architectureOnly: true,
    engine: buildKnowledgeEngine(),
    pipeline: buildKnowledgePipeline(),
    registry: listKnowledgeRegistry(),
    providers,
    sources: buildKnowledgeSources(),
    documents: buildKnowledgeDocuments(),
    entities: buildKnowledgeEntities(),
    categories: buildKnowledgeCategories(),
    graph: buildKnowledgeGraph(),
    references: buildKnowledgeReferences(),
    context: buildKnowledgeContext(sessionId, locale),
    retrieval: buildKnowledgeRetrieval(),
    ranking: buildKnowledgeRanking(),
    resolution: buildKnowledgeResolution(),
    validation: buildKnowledgeValidation(),
    freshness: buildKnowledgeFreshness(),
    confidence: buildKnowledgeConfidence(0.5),
    provenance: buildKnowledgeProvenance(),
    cache: buildKnowledgeCache(),
    events: [
      buildKnowledgeEvent(sessionId, 'session_started', 'architecture blueprint'),
      buildKnowledgeEvent(sessionId, 'context_attached', 'empty context'),
    ],
    analytics: buildKnowledgeAnalytics(sessionId, providers.length),
    auditTrail: buildKnowledgeAuditTrail(),
    stateMachine: buildKnowledgeStateMachine(),
    coverageDomains: KNOWLEDGE_COVERAGE_DOMAINS,
  }
}

export function tryBuildKnowledgeEngineBlueprint(
  options: BuildKnowledgeBlueprintOptions = {},
): KnowledgeEngineBlueprint | null {
  if (!isBrainKnowledgeEngineEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildKnowledgeEngineBlueprint(options)
}

export function assertKnowledgeEngineIsolation(): typeof KNOWLEDGE_ENGINE_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...KNOWLEDGE_ENGINE_ISOLATION,
    architectureOnly: true,
    registrySize: listKnowledgeRegistry().length,
  }
}

export const KnowledgeEngine = {
  buildBlueprint: buildKnowledgeEngineBlueprint,
  tryBuildBlueprint: tryBuildKnowledgeEngineBlueprint,
  assertIsolation: assertKnowledgeEngineIsolation,
}
