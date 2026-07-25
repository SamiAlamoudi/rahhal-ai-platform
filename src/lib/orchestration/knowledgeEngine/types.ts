/**
 * Phase 6 Stage 6 — AI Knowledge Engine contracts.
 * Architecture / interfaces / types / blueprints only.
 * No LLM, APIs, DB, vector search, or Runtime.
 */

export type KnowledgeLocale = 'ar' | 'en'

export type KnowledgeStateId =
  | 'idle'
  | 'resolving_sources'
  | 'retrieving'
  | 'ranking'
  | 'validating'
  | 'freshening'
  | 'ready'
  | 'closed'

export type KnowledgeEventKind =
  | 'session_started'
  | 'context_attached'
  | 'sources_resolved'
  | 'documents_listed'
  | 'entities_listed'
  | 'graph_attached'
  | 'knowledge_retrieved'
  | 'knowledge_ranked'
  | 'knowledge_validated'
  | 'freshness_checked'
  | 'confidence_scored'
  | 'cache_hinted'
  | 'audit_appended'
  | 'state_transition'
  | 'session_ended'

export type KnowledgeConfidenceBand = 'low' | 'medium' | 'high'

export type KnowledgeModuleHint =
  | 'knowledge_center'
  | 'memory_center'
  | 'conversation_center'
  | 'decision_center'
  | 'insights_center'
  | 'travel_workspace'
  | 'booking_hub'
  | 'traveler_profile'

export type KnowledgePipelineStageId =
  | 'attach_context'
  | 'resolve_providers'
  | 'resolve_sources'
  | 'list_documents'
  | 'list_entities'
  | 'list_categories'
  | 'attach_graph'
  | 'resolve_references'
  | 'retrieve'
  | 'rank'
  | 'validate'
  | 'check_freshness'
  | 'score_confidence'
  | 'attach_provenance'
  | 'hint_cache'
  | 'append_audit'

export type KnowledgeCoverageDomain =
  | 'destination'
  | 'country'
  | 'visa'
  | 'airline'
  | 'airport'
  | 'hotel'
  | 'activity'
  | 'transportation'
  | 'travel_rules'
  | 'travel_restrictions'
  | 'weather_reference'
  | 'currency_reference'
  | 'language_reference'
  | 'timezone_reference'
  | 'culture_reference'
  | 'emergency_information'
  | 'faq_reference'
  | 'policy_reference'

export type KnowledgeProviderKind =
  | 'internal_catalog'
  | 'curated_document'
  | 'policy_manual'
  | 'reference_table'
  | 'external_placeholder'

export interface KnowledgeEngineContract {
  kind: 'knowledge_engine'
  version: '6.6.0-knowledge-engine'
  execution: 'none'
}

export interface KnowledgePipelineContract {
  kind: 'knowledge_pipeline'
  stages: readonly KnowledgePipelineStageId[]
  execution: 'none'
}

export interface KnowledgeRegistryEntry {
  id: string
  domain: KnowledgeCoverageDomain
  moduleHints: readonly KnowledgeModuleHint[]
}

export interface KnowledgeProviderContract {
  kind: 'knowledge_provider'
  providerId: string
  providerKind: KnowledgeProviderKind
  domains: readonly KnowledgeCoverageDomain[]
  execution: 'none'
}

export interface KnowledgeSourceContract {
  kind: 'knowledge_source'
  sourceId: string
  label: string
  providerId: string
  domain: KnowledgeCoverageDomain
}

export interface KnowledgeDocumentContract {
  kind: 'knowledge_document'
  documentId: string
  title: string
  categoryId: string
  sourceId: string
}

export interface KnowledgeEntityContract {
  kind: 'knowledge_entity'
  entityId: string
  typeHint: string
  label: string
  domain: KnowledgeCoverageDomain
}

export interface KnowledgeCategoryContract {
  kind: 'knowledge_category'
  categoryId: string
  label: string
  domain: KnowledgeCoverageDomain
}

export interface KnowledgeGraphNodeContract {
  id: string
  label: string
  domain: KnowledgeCoverageDomain
}

export interface KnowledgeGraphEdgeContract {
  id: string
  fromId: string
  toId: string
  relationHint: string
}

export interface KnowledgeGraphContract {
  kind: 'knowledge_graph'
  nodes: readonly KnowledgeGraphNodeContract[]
  edges: readonly KnowledgeGraphEdgeContract[]
  execution: 'none'
}

export interface KnowledgeReferenceContract {
  kind: 'knowledge_reference'
  refId: string
  targetId: string
  targetKind: 'document' | 'entity' | 'source' | 'category'
}

export interface KnowledgeContextContract {
  kind: 'knowledge_context'
  sessionId: string
  locale: KnowledgeLocale
  queryHints: readonly string[]
  domainHints: readonly KnowledgeCoverageDomain[]
  moduleHints: readonly KnowledgeModuleHint[]
}

export interface KnowledgeRetrievalContract {
  kind: 'knowledge_retrieval'
  strategyId: string
  steps: readonly string[]
  resultIds: readonly string[]
  execution: 'none'
}

export interface KnowledgeRankingContract {
  kind: 'knowledge_ranking'
  rankedIds: readonly string[]
  methodHint: string
  execution: 'none'
}

export interface KnowledgeResolutionContract {
  kind: 'knowledge_resolution'
  resolvedIds: readonly string[]
  unresolvedHints: readonly string[]
  execution: 'none'
}

export interface KnowledgeValidationContract {
  kind: 'knowledge_validation'
  checks: readonly string[]
  issues: readonly string[]
  execution: 'none'
}

export interface KnowledgeFreshnessContract {
  kind: 'knowledge_freshness'
  statusHint: 'unknown' | 'fresh' | 'stale'
  checkedAtIso: string
  execution: 'none'
}

export interface KnowledgeConfidenceContract {
  kind: 'knowledge_confidence'
  score: number
  band: KnowledgeConfidenceBand
  factors: readonly string[]
  execution: 'none'
}

export interface KnowledgeProvenanceContract {
  kind: 'knowledge_provenance'
  entries: readonly {
    id: string
    sourceId: string
    providerId: string
    note: string
  }[]
  execution: 'none'
}

export interface KnowledgeCacheContract {
  kind: 'knowledge_cache'
  cacheKeyHints: readonly string[]
  /** Never a real cache. */
  backed: false
  execution: 'none'
}

export interface KnowledgeEventContract {
  kind: 'knowledge_event'
  eventId: string
  eventKind: KnowledgeEventKind
  sessionId: string
  atIso: string
  payloadSummary: string
}

export interface KnowledgeAnalyticsContract {
  kind: 'knowledge_analytics'
  sessionId: string
  domainCount: number
  providerCount: number
  stageCount: number
  averageConfidence: number
  exported: false
}

export interface KnowledgeAuditEntry {
  id: string
  atIso: string
  action: string
  detail: string
}

export interface KnowledgeAuditTrailContract {
  kind: 'knowledge_audit_trail'
  entries: readonly KnowledgeAuditEntry[]
  persisted: false
}

export interface KnowledgeStateTransition {
  from: KnowledgeStateId
  to: KnowledgeStateId
  reason: string
}

export interface KnowledgeStateMachineContract {
  kind: 'knowledge_state_machine'
  current: KnowledgeStateId
  allowed: readonly KnowledgeStateId[]
  lastTransition: KnowledgeStateTransition | null
  execution: 'none'
}

export interface KnowledgeEngineBlueprint {
  version: '6.6.0-knowledge-engine'
  featureId: 'brain.knowledge_engine'
  architectureOnly: true
  engine: KnowledgeEngineContract
  pipeline: KnowledgePipelineContract
  registry: readonly KnowledgeRegistryEntry[]
  providers: readonly KnowledgeProviderContract[]
  sources: readonly KnowledgeSourceContract[]
  documents: readonly KnowledgeDocumentContract[]
  entities: readonly KnowledgeEntityContract[]
  categories: readonly KnowledgeCategoryContract[]
  graph: KnowledgeGraphContract
  references: readonly KnowledgeReferenceContract[]
  context: KnowledgeContextContract
  retrieval: KnowledgeRetrievalContract
  ranking: KnowledgeRankingContract
  resolution: KnowledgeResolutionContract
  validation: KnowledgeValidationContract
  freshness: KnowledgeFreshnessContract
  confidence: KnowledgeConfidenceContract
  provenance: KnowledgeProvenanceContract
  cache: KnowledgeCacheContract
  events: readonly KnowledgeEventContract[]
  analytics: KnowledgeAnalyticsContract
  auditTrail: KnowledgeAuditTrailContract
  stateMachine: KnowledgeStateMachineContract
  coverageDomains: readonly KnowledgeCoverageDomain[]
}

export const KNOWLEDGE_ENGINE_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoOpenAi: false,
  wiredIntoClaude: false,
  wiredIntoGemini: false,
  wiredIntoLlms: false,
  wiredIntoApis: false,
  wiredIntoAmadeus: false,
  wiredIntoGoogleMaps: false,
  wiredIntoWeatherApis: false,
  wiredIntoSupabase: false,
  wiredIntoFirebase: false,
  wiredIntoRedis: false,
  wiredIntoDatabase: false,
  wiredIntoVectorDb: false,
  wiredIntoSearchBackend: false,
  wiredIntoStorage: false,
  wiredIntoRuntime: false,
  knowledgeImplementation: false,
  businessLogic: false,
} as const

export const KNOWLEDGE_PIPELINE_STAGES: readonly KnowledgePipelineStageId[] = [
  'attach_context',
  'resolve_providers',
  'resolve_sources',
  'list_documents',
  'list_entities',
  'list_categories',
  'attach_graph',
  'resolve_references',
  'retrieve',
  'rank',
  'validate',
  'check_freshness',
  'score_confidence',
  'attach_provenance',
  'hint_cache',
  'append_audit',
] as const

export const KNOWLEDGE_STATE_IDS: readonly KnowledgeStateId[] = [
  'idle',
  'resolving_sources',
  'retrieving',
  'ranking',
  'validating',
  'freshening',
  'ready',
  'closed',
] as const

export const KNOWLEDGE_COVERAGE_DOMAINS: readonly KnowledgeCoverageDomain[] = [
  'destination',
  'country',
  'visa',
  'airline',
  'airport',
  'hotel',
  'activity',
  'transportation',
  'travel_rules',
  'travel_restrictions',
  'weather_reference',
  'currency_reference',
  'language_reference',
  'timezone_reference',
  'culture_reference',
  'emergency_information',
  'faq_reference',
  'policy_reference',
] as const

export const KNOWLEDGE_MODULE_HINTS: readonly KnowledgeModuleHint[] = [
  'knowledge_center',
  'memory_center',
  'conversation_center',
  'decision_center',
  'insights_center',
  'travel_workspace',
  'booking_hub',
  'traveler_profile',
] as const
