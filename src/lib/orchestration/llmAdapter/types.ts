/**
 * Phase 6 Stage 8 — AI LLM Adapter Layer contracts.
 * Architecture / interfaces / types / blueprints only.
 * No SDKs, API keys, HTTP, Runtime, streaming, or provider calls.
 */

export type LlmLocale = 'ar' | 'en'

export type LlmStateId =
  | 'idle'
  | 'selecting_provider'
  | 'building_context'
  | 'building_prompt'
  | 'requesting'
  | 'streaming_hint'
  | 'normalizing'
  | 'accounting'
  | 'ready'
  | 'failed'
  | 'closed'

export type LlmEventKind =
  | 'session_started'
  | 'provider_selected'
  | 'provider_ranked'
  | 'context_built'
  | 'prompt_built'
  | 'request_prepared'
  | 'response_prepared'
  | 'normalized'
  | 'tokens_accounted'
  | 'cost_hinted'
  | 'retry_scheduled'
  | 'timeout_hinted'
  | 'error_recorded'
  | 'audit_appended'
  | 'state_transition'
  | 'session_ended'

export type LlmProviderId =
  | 'openai'
  | 'claude'
  | 'gemini'
  | 'azure_openai'
  | 'openrouter'
  | 'local_models'
  | 'future_providers'

export type LlmRequestPipelineStageId =
  | 'attach_session'
  | 'select_provider'
  | 'rank_providers'
  | 'build_context'
  | 'build_system_prompt'
  | 'build_prompt'
  | 'attach_tool_call_contracts'
  | 'attach_function_call_contracts'
  | 'prepare_request'
  | 'apply_timeout_hint'
  | 'apply_retry_hint'
  | 'append_audit'

export type LlmResponsePipelineStageId =
  | 'receive_placeholder'
  | 'normalize_response'
  | 'map_tool_calls'
  | 'map_function_calls'
  | 'account_tokens'
  | 'hint_cost'
  | 'record_error'
  | 'emit_analytics'
  | 'append_audit'

export interface LlmAdapterContract {
  kind: 'llm_adapter'
  version: '6.8.0-llm-adapter'
  execution: 'none'
}

export interface LlmProviderInterfaceContract {
  kind: 'llm_provider_interface'
  methods: readonly string[]
  execution: 'none'
}

export interface LlmProviderContract {
  kind: 'llm_provider_contract'
  providerId: LlmProviderId
  label: string
  capabilitiesHint: readonly string[]
  execution: 'none'
}

export interface LlmRegistryEntry {
  id: string
  providerId: LlmProviderId
  enabledHint: false
  rankHint: number
}

export interface LlmRequestPipelineContract {
  kind: 'llm_request_pipeline'
  stages: readonly LlmRequestPipelineStageId[]
  execution: 'none'
}

export interface LlmResponsePipelineContract {
  kind: 'llm_response_pipeline'
  stages: readonly LlmResponsePipelineStageId[]
  execution: 'none'
}

export interface LlmContextBuilderContract {
  kind: 'llm_context_builder'
  sessionId: string
  contextKeys: readonly string[]
  execution: 'none'
}

export interface LlmPromptBuilderContract {
  kind: 'llm_prompt_builder'
  promptShapeHint: string
  execution: 'none'
}

export interface LlmSystemPromptContract {
  kind: 'llm_system_prompt'
  templateId: string
  locale: LlmLocale
  execution: 'none'
}

export interface LlmToolCallContract {
  kind: 'llm_tool_call'
  toolCallSchemaHint: string
  execution: 'none'
}

export interface LlmFunctionCallContract {
  kind: 'llm_function_call'
  functionCallSchemaHint: string
  execution: 'none'
}

export interface LlmStreamingContract {
  kind: 'llm_streaming'
  streamingSupportedHint: false
  execution: 'none'
}

export interface LlmResponseNormalizerContract {
  kind: 'llm_response_normalizer'
  normalizedShapeHint: string
  execution: 'none'
}

export interface LlmErrorModelContract {
  kind: 'llm_error_model'
  codes: readonly string[]
  retryableHints: readonly string[]
  execution: 'none'
}

export interface LlmRetryStrategyContract {
  kind: 'llm_retry_strategy'
  maxAttemptsHint: number
  backoffHint: string
  execution: 'none'
}

export interface LlmTimeoutStrategyContract {
  kind: 'llm_timeout_strategy'
  timeoutMsHint: number
  execution: 'none'
}

export interface LlmCostModelContract {
  kind: 'llm_cost_model'
  currencyHint: string
  unitHint: string
  estimated: false
  execution: 'none'
}

export interface LlmTokenAccountingContract {
  kind: 'llm_token_accounting'
  promptTokensHint: number
  completionTokensHint: number
  totalTokensHint: number
  metered: false
  execution: 'none'
}

export interface LlmProviderSelectionContract {
  kind: 'llm_provider_selection'
  selectedProviderId: LlmProviderId | null
  reasonHint: string
  execution: 'none'
}

export interface LlmProviderRankingContract {
  kind: 'llm_provider_ranking'
  ranked: readonly { providerId: LlmProviderId; scoreHint: number }[]
  execution: 'none'
}

export interface LlmEventContract {
  kind: 'llm_event'
  eventId: string
  eventKind: LlmEventKind
  sessionId: string
  atIso: string
  payloadSummary: string
}

export interface LlmAnalyticsContract {
  kind: 'llm_analytics'
  sessionId: string
  providerCount: number
  requestStageCount: number
  responseStageCount: number
  exported: false
}

export interface LlmAuditEntry {
  id: string
  atIso: string
  action: string
  detail: string
}

export interface LlmAuditTrailContract {
  kind: 'llm_audit_trail'
  entries: readonly LlmAuditEntry[]
  persisted: false
}

export interface LlmStateTransition {
  from: LlmStateId
  to: LlmStateId
  reason: string
}

export interface LlmStateMachineContract {
  kind: 'llm_state_machine'
  current: LlmStateId
  allowed: readonly LlmStateId[]
  lastTransition: LlmStateTransition | null
  execution: 'none'
}

export interface LlmAdapterBlueprint {
  version: '6.8.0-llm-adapter'
  featureId: 'brain.llm_adapter'
  architectureOnly: true
  adapter: LlmAdapterContract
  providerInterface: LlmProviderInterfaceContract
  providerContracts: readonly LlmProviderContract[]
  registry: readonly LlmRegistryEntry[]
  requestPipeline: LlmRequestPipelineContract
  responsePipeline: LlmResponsePipelineContract
  contextBuilder: LlmContextBuilderContract
  promptBuilder: LlmPromptBuilderContract
  systemPrompt: LlmSystemPromptContract
  toolCall: LlmToolCallContract
  functionCall: LlmFunctionCallContract
  streaming: LlmStreamingContract
  responseNormalizer: LlmResponseNormalizerContract
  errorModel: LlmErrorModelContract
  retryStrategy: LlmRetryStrategyContract
  timeoutStrategy: LlmTimeoutStrategyContract
  costModel: LlmCostModelContract
  tokenAccounting: LlmTokenAccountingContract
  providerSelection: LlmProviderSelectionContract
  providerRanking: LlmProviderRankingContract
  events: readonly LlmEventContract[]
  analytics: LlmAnalyticsContract
  auditTrail: LlmAuditTrailContract
  stateMachine: LlmStateMachineContract
  futureProviders: readonly LlmProviderId[]
}

export const LLM_ADAPTER_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoOpenAiSdk: false,
  wiredIntoClaudeSdk: false,
  wiredIntoGeminiSdk: false,
  wiredIntoProviderSdks: false,
  apiKeysPresent: false,
  httpRequests: false,
  streamingImplemented: false,
  wiredIntoFirebase: false,
  wiredIntoSupabase: false,
  wiredIntoRedis: false,
  wiredIntoDatabase: false,
  wiredIntoStorage: false,
  wiredIntoAuth: false,
  wiredIntoRuntime: false,
  businessLogic: false,
} as const

export const LLM_REQUEST_PIPELINE_STAGES: readonly LlmRequestPipelineStageId[] =
  [
    'attach_session',
    'select_provider',
    'rank_providers',
    'build_context',
    'build_system_prompt',
    'build_prompt',
    'attach_tool_call_contracts',
    'attach_function_call_contracts',
    'prepare_request',
    'apply_timeout_hint',
    'apply_retry_hint',
    'append_audit',
  ] as const

export const LLM_RESPONSE_PIPELINE_STAGES: readonly LlmResponsePipelineStageId[] =
  [
    'receive_placeholder',
    'normalize_response',
    'map_tool_calls',
    'map_function_calls',
    'account_tokens',
    'hint_cost',
    'record_error',
    'emit_analytics',
    'append_audit',
  ] as const

export const LLM_STATE_IDS: readonly LlmStateId[] = [
  'idle',
  'selecting_provider',
  'building_context',
  'building_prompt',
  'requesting',
  'streaming_hint',
  'normalizing',
  'accounting',
  'ready',
  'failed',
  'closed',
] as const

export const LLM_FUTURE_PROVIDERS: readonly LlmProviderId[] = [
  'openai',
  'claude',
  'gemini',
  'azure_openai',
  'openrouter',
  'local_models',
  'future_providers',
] as const
