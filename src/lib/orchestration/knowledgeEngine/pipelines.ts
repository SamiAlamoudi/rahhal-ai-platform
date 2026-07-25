/**
 * Knowledge pipeline & component contracts — pure builders, no implementation.
 */

import type {
  KnowledgeAnalyticsContract,
  KnowledgeAuditTrailContract,
  KnowledgeCacheContract,
  KnowledgeCategoryContract,
  KnowledgeConfidenceContract,
  KnowledgeContextContract,
  KnowledgeDocumentContract,
  KnowledgeEngineContract,
  KnowledgeEntityContract,
  KnowledgeEventContract,
  KnowledgeFreshnessContract,
  KnowledgeGraphContract,
  KnowledgeLocale,
  KnowledgePipelineContract,
  KnowledgeProvenanceContract,
  KnowledgeProviderContract,
  KnowledgeRankingContract,
  KnowledgeReferenceContract,
  KnowledgeResolutionContract,
  KnowledgeRetrievalContract,
  KnowledgeSourceContract,
  KnowledgeStateMachineContract,
  KnowledgeValidationContract,
} from './types'
import {
  KNOWLEDGE_COVERAGE_DOMAINS,
  KNOWLEDGE_MODULE_HINTS,
  KNOWLEDGE_PIPELINE_STAGES,
  KNOWLEDGE_STATE_IDS,
} from './types'

const ISO = '2026-07-25T00:00:00.000Z'

export function buildKnowledgeEngine(): KnowledgeEngineContract {
  return {
    kind: 'knowledge_engine',
    version: '6.6.0-knowledge-engine',
    execution: 'none',
  }
}

export function buildKnowledgePipeline(): KnowledgePipelineContract {
  return {
    kind: 'knowledge_pipeline',
    stages: KNOWLEDGE_PIPELINE_STAGES,
    execution: 'none',
  }
}

export function buildKnowledgeProviders(): KnowledgeProviderContract[] {
  return [
    {
      kind: 'knowledge_provider',
      providerId: 'prov-internal-catalog',
      providerKind: 'internal_catalog',
      domains: KNOWLEDGE_COVERAGE_DOMAINS,
      execution: 'none',
    },
    {
      kind: 'knowledge_provider',
      providerId: 'prov-curated-docs',
      providerKind: 'curated_document',
      domains: ['faq_reference', 'policy_reference', 'visa'],
      execution: 'none',
    },
    {
      kind: 'knowledge_provider',
      providerId: 'prov-reference-tables',
      providerKind: 'reference_table',
      domains: [
        'currency_reference',
        'language_reference',
        'timezone_reference',
        'weather_reference',
      ],
      execution: 'none',
    },
    {
      kind: 'knowledge_provider',
      providerId: 'prov-external-placeholder',
      providerKind: 'external_placeholder',
      domains: ['airline', 'airport', 'hotel'],
      execution: 'none',
    },
  ]
}

export function buildKnowledgeSources(): KnowledgeSourceContract[] {
  return KNOWLEDGE_COVERAGE_DOMAINS.map((domain) => ({
    kind: 'knowledge_source' as const,
    sourceId: `src-${domain}`,
    label: `${domain} source placeholder`,
    providerId: 'prov-internal-catalog',
    domain,
  }))
}

export function buildKnowledgeDocuments(): KnowledgeDocumentContract[] {
  return []
}

export function buildKnowledgeEntities(): KnowledgeEntityContract[] {
  return []
}

export function buildKnowledgeCategories(): KnowledgeCategoryContract[] {
  return KNOWLEDGE_COVERAGE_DOMAINS.map((domain) => ({
    kind: 'knowledge_category' as const,
    categoryId: `cat-${domain}`,
    label: domain,
    domain,
  }))
}

export function buildKnowledgeGraph(): KnowledgeGraphContract {
  return {
    kind: 'knowledge_graph',
    nodes: [],
    edges: [],
    execution: 'none',
  }
}

export function buildKnowledgeReferences(): KnowledgeReferenceContract[] {
  return []
}

export function buildKnowledgeContext(
  sessionId: string,
  locale: KnowledgeLocale = 'ar',
): KnowledgeContextContract {
  return {
    kind: 'knowledge_context',
    sessionId,
    locale,
    queryHints: [],
    domainHints: KNOWLEDGE_COVERAGE_DOMAINS,
    moduleHints: KNOWLEDGE_MODULE_HINTS,
  }
}

export function buildKnowledgeRetrieval(): KnowledgeRetrievalContract {
  return {
    kind: 'knowledge_retrieval',
    strategyId: 'architecture_placeholder',
    steps: ['filter_by_domain', 'filter_by_source', 'order_by_relevance_hint'],
    resultIds: [],
    execution: 'none',
  }
}

export function buildKnowledgeRanking(): KnowledgeRankingContract {
  return {
    kind: 'knowledge_ranking',
    rankedIds: [],
    methodHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildKnowledgeResolution(): KnowledgeResolutionContract {
  return {
    kind: 'knowledge_resolution',
    resolvedIds: [],
    unresolvedHints: [],
    execution: 'none',
  }
}

export function buildKnowledgeValidation(): KnowledgeValidationContract {
  return {
    kind: 'knowledge_validation',
    checks: ['has_source', 'has_domain', 'has_provenance_hint'],
    issues: [],
    execution: 'none',
  }
}

export function buildKnowledgeFreshness(): KnowledgeFreshnessContract {
  return {
    kind: 'knowledge_freshness',
    statusHint: 'unknown',
    checkedAtIso: ISO,
    execution: 'none',
  }
}

export function buildKnowledgeConfidence(
  score = 0.5,
): KnowledgeConfidenceContract {
  const band = score >= 0.75 ? 'high' : score >= 0.4 ? 'medium' : 'low'
  return {
    kind: 'knowledge_confidence',
    score,
    band,
    factors: ['architecture_placeholder'],
    execution: 'none',
  }
}

export function buildKnowledgeProvenance(): KnowledgeProvenanceContract {
  return {
    kind: 'knowledge_provenance',
    entries: [],
    execution: 'none',
  }
}

export function buildKnowledgeCache(): KnowledgeCacheContract {
  return {
    kind: 'knowledge_cache',
    cacheKeyHints: [],
    backed: false,
    execution: 'none',
  }
}

export function buildKnowledgeEvent(
  sessionId: string,
  eventKind: KnowledgeEventContract['eventKind'],
  payloadSummary: string,
): KnowledgeEventContract {
  return {
    kind: 'knowledge_event',
    eventId: `kevt-${eventKind}`,
    eventKind,
    sessionId,
    atIso: ISO,
    payloadSummary,
  }
}

export function buildKnowledgeAnalytics(
  sessionId: string,
  providerCount: number,
): KnowledgeAnalyticsContract {
  return {
    kind: 'knowledge_analytics',
    sessionId,
    domainCount: KNOWLEDGE_COVERAGE_DOMAINS.length,
    providerCount,
    stageCount: KNOWLEDGE_PIPELINE_STAGES.length,
    averageConfidence: 0,
    exported: false,
  }
}

export function buildKnowledgeAuditTrail(): KnowledgeAuditTrailContract {
  return {
    kind: 'knowledge_audit_trail',
    entries: [
      {
        id: 'kaudit-open',
        atIso: ISO,
        action: 'session_started',
        detail: 'architecture blueprint',
      },
    ],
    persisted: false,
  }
}

export function buildKnowledgeStateMachine(): KnowledgeStateMachineContract {
  return {
    kind: 'knowledge_state_machine',
    current: 'idle',
    allowed: KNOWLEDGE_STATE_IDS,
    lastTransition: null,
    execution: 'none',
  }
}
