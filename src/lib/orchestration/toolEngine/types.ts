/**
 * Phase 6 Stage 7 — AI Tool Execution Engine contracts.
 * Architecture / interfaces / types / blueprints only.
 * No LLM, APIs, Runtime, database, or tool execution.
 */

export type ToolLocale = 'ar' | 'en'

export type ToolStateId =
  | 'idle'
  | 'discovering'
  | 'resolving'
  | 'validating_input'
  | 'queued'
  | 'dispatching'
  | 'awaiting_result'
  | 'validating_output'
  | 'normalizing'
  | 'ready'
  | 'failed'
  | 'closed'

export type ToolEventKind =
  | 'session_started'
  | 'tool_discovered'
  | 'tool_resolved'
  | 'input_validated'
  | 'dispatched'
  | 'retry_scheduled'
  | 'timeout_hinted'
  | 'circuit_opened'
  | 'output_validated'
  | 'result_normalized'
  | 'error_recorded'
  | 'audit_appended'
  | 'state_transition'
  | 'session_ended'

export type ToolFutureCapabilityId =
  | 'flight_search'
  | 'hotel_search'
  | 'activity_search'
  | 'visa_services'
  | 'weather'
  | 'maps'
  | 'currency'
  | 'calendar'
  | 'email'
  | 'whatsapp'
  | 'notifications'
  | 'payments'
  | 'booking_apis'
  | 'crm'
  | 'document_processing'
  | 'translation'
  | 'voice'
  | 'image'

export type ToolPipelineStageId =
  | 'attach_context'
  | 'discover_tools'
  | 'resolve_tool'
  | 'check_permissions'
  | 'apply_policies'
  | 'inject_context'
  | 'validate_input'
  | 'enqueue'
  | 'route'
  | 'dispatch'
  | 'await_or_timeout'
  | 'apply_retry'
  | 'check_circuit'
  | 'validate_output'
  | 'normalize_result'
  | 'record_error'
  | 'emit_analytics'
  | 'append_audit'

export type ToolPermissionLevel = 'none' | 'read' | 'write' | 'admin_hint'

export interface ToolExecutionEngineContract {
  kind: 'tool_execution_engine'
  version: '6.7.0-tool-engine'
  execution: 'none'
}

export interface ToolExecutionPipelineContract {
  kind: 'tool_execution_pipeline'
  stages: readonly ToolPipelineStageId[]
  execution: 'none'
}

export interface ToolContract {
  kind: 'tool_contract'
  toolId: string
  capabilityId: ToolFutureCapabilityId
  inputSchemaHint: string
  outputSchemaHint: string
  execution: 'none'
}

export interface ToolMetadataContract {
  kind: 'tool_metadata'
  toolId: string
  label: string
  versionHint: string
  tags: readonly string[]
}

export interface ToolRegistryEntry {
  id: string
  capabilityId: ToolFutureCapabilityId
  toolId: string
  enabledHint: false
}

export interface ToolCapabilityRegistryEntry {
  capabilityId: ToolFutureCapabilityId
  label: string
  categoryHint: string
}

export interface ToolRouterContract {
  kind: 'tool_router'
  routeHints: readonly { capabilityId: ToolFutureCapabilityId; toolId: string }[]
  execution: 'none'
}

export interface ToolDispatcherContract {
  kind: 'tool_dispatcher'
  dispatchModeHint: 'sync_placeholder' | 'async_placeholder'
  execution: 'none'
}

export interface ToolResolverContract {
  kind: 'tool_resolver'
  resolvedToolId: string | null
  unresolvedHints: readonly string[]
  execution: 'none'
}

export interface ToolDiscoveryContract {
  kind: 'tool_discovery'
  discoveredToolIds: readonly string[]
  execution: 'none'
}

export interface ToolPermissionsContract {
  kind: 'tool_permissions'
  toolId: string
  level: ToolPermissionLevel
  roles: readonly string[]
  execution: 'none'
}

export interface ToolPoliciesContract {
  kind: 'tool_policies'
  policyIds: readonly string[]
  rules: readonly string[]
  execution: 'none'
}

export interface ToolContextInjectionContract {
  kind: 'tool_context_injection'
  sessionId: string
  injectedKeys: readonly string[]
  execution: 'none'
}

export interface ToolInputValidationContract {
  kind: 'tool_input_validation'
  valid: boolean
  issues: readonly string[]
  execution: 'none'
}

export interface ToolOutputValidationContract {
  kind: 'tool_output_validation'
  valid: boolean
  issues: readonly string[]
  execution: 'none'
}

export interface ToolResultNormalizationContract {
  kind: 'tool_result_normalization'
  normalizedShapeHint: string
  execution: 'none'
}

export interface ToolErrorModelContract {
  kind: 'tool_error_model'
  codes: readonly string[]
  retryableHints: readonly string[]
  execution: 'none'
}

export interface ToolRetryStrategyContract {
  kind: 'tool_retry_strategy'
  maxAttemptsHint: number
  backoffHint: string
  execution: 'none'
}

export interface ToolTimeoutStrategyContract {
  kind: 'tool_timeout_strategy'
  timeoutMsHint: number
  execution: 'none'
}

export interface ToolCircuitBreakerContract {
  kind: 'tool_circuit_breaker'
  stateHint: 'closed' | 'open' | 'half_open'
  failureThresholdHint: number
  execution: 'none'
}

export interface ToolQueueContract {
  kind: 'tool_queue'
  items: readonly { id: string; toolId: string; priorityHint: string }[]
  execution: 'none'
}

export interface ToolEventContract {
  kind: 'tool_event'
  eventId: string
  eventKind: ToolEventKind
  sessionId: string
  atIso: string
  payloadSummary: string
}

export interface ToolAnalyticsContract {
  kind: 'tool_analytics'
  sessionId: string
  capabilityCount: number
  stageCount: number
  exported: false
}

export interface ToolAuditEntry {
  id: string
  atIso: string
  action: string
  detail: string
}

export interface ToolAuditTrailContract {
  kind: 'tool_audit_trail'
  entries: readonly ToolAuditEntry[]
  persisted: false
}

export interface ToolStateTransition {
  from: ToolStateId
  to: ToolStateId
  reason: string
}

export interface ToolStateMachineContract {
  kind: 'tool_state_machine'
  current: ToolStateId
  allowed: readonly ToolStateId[]
  lastTransition: ToolStateTransition | null
  execution: 'none'
}

export interface ToolEngineBlueprint {
  version: '6.7.0-tool-engine'
  featureId: 'brain.tool_engine'
  architectureOnly: true
  engine: ToolExecutionEngineContract
  pipeline: ToolExecutionPipelineContract
  registry: readonly ToolRegistryEntry[]
  capabilityRegistry: readonly ToolCapabilityRegistryEntry[]
  toolContracts: readonly ToolContract[]
  metadata: readonly ToolMetadataContract[]
  router: ToolRouterContract
  dispatcher: ToolDispatcherContract
  resolver: ToolResolverContract
  discovery: ToolDiscoveryContract
  permissions: readonly ToolPermissionsContract[]
  policies: ToolPoliciesContract
  contextInjection: ToolContextInjectionContract
  inputValidation: ToolInputValidationContract
  outputValidation: ToolOutputValidationContract
  resultNormalization: ToolResultNormalizationContract
  errorModel: ToolErrorModelContract
  retryStrategy: ToolRetryStrategyContract
  timeoutStrategy: ToolTimeoutStrategyContract
  circuitBreaker: ToolCircuitBreakerContract
  queue: ToolQueueContract
  events: readonly ToolEventContract[]
  analytics: ToolAnalyticsContract
  auditTrail: ToolAuditTrailContract
  stateMachine: ToolStateMachineContract
  futureCapabilities: readonly ToolFutureCapabilityId[]
}

export const TOOL_ENGINE_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoOpenAi: false,
  wiredIntoClaude: false,
  wiredIntoGemini: false,
  wiredIntoLlms: false,
  wiredIntoAmadeus: false,
  wiredIntoGoogleApis: false,
  wiredIntoMapsApis: false,
  wiredIntoWeatherApis: false,
  wiredIntoFirebase: false,
  wiredIntoSupabase: false,
  wiredIntoRedis: false,
  wiredIntoDatabase: false,
  wiredIntoStorage: false,
  wiredIntoRuntime: false,
  toolExecution: false,
  businessLogic: false,
} as const

export const TOOL_PIPELINE_STAGES: readonly ToolPipelineStageId[] = [
  'attach_context',
  'discover_tools',
  'resolve_tool',
  'check_permissions',
  'apply_policies',
  'inject_context',
  'validate_input',
  'enqueue',
  'route',
  'dispatch',
  'await_or_timeout',
  'apply_retry',
  'check_circuit',
  'validate_output',
  'normalize_result',
  'record_error',
  'emit_analytics',
  'append_audit',
] as const

export const TOOL_STATE_IDS: readonly ToolStateId[] = [
  'idle',
  'discovering',
  'resolving',
  'validating_input',
  'queued',
  'dispatching',
  'awaiting_result',
  'validating_output',
  'normalizing',
  'ready',
  'failed',
  'closed',
] as const

export const TOOL_FUTURE_CAPABILITIES: readonly ToolFutureCapabilityId[] = [
  'flight_search',
  'hotel_search',
  'activity_search',
  'visa_services',
  'weather',
  'maps',
  'currency',
  'calendar',
  'email',
  'whatsapp',
  'notifications',
  'payments',
  'booking_apis',
  'crm',
  'document_processing',
  'translation',
  'voice',
  'image',
] as const
