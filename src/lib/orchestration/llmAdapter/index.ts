/**
 * Phase 6 Stage 8 — AI LLM Adapter Layer barrel.
 *
 * Architecture / contracts / types / blueprints only.
 * Gated by `brain.llm_adapter` (default OFF).
 * No SDKs, API keys, HTTP, Runtime, streaming, or production wiring.
 */

import { LLM_ADAPTER_ISOLATION as LA_ISOLATION } from './types'
import {
  LLM_FUTURE_PROVIDERS,
  LLM_REQUEST_PIPELINE_STAGES,
  LLM_RESPONSE_PIPELINE_STAGES,
} from './types'

export {
  BRAIN_LLM_ADAPTER_FEATURE_ID,
  isBrainLlmAdapterEnabled,
  listLlmRegistry,
  listLlmFutureProviders,
  LlmRegistry,
  LLM_REGISTRY,
} from './registry'

export type {
  LlmLocale,
  LlmStateId,
  LlmEventKind,
  LlmProviderId,
  LlmRequestPipelineStageId,
  LlmResponsePipelineStageId,
  LlmAdapterContract,
  LlmProviderInterfaceContract,
  LlmProviderContract,
  LlmRegistryEntry,
  LlmRequestPipelineContract,
  LlmResponsePipelineContract,
  LlmContextBuilderContract,
  LlmPromptBuilderContract,
  LlmSystemPromptContract,
  LlmToolCallContract,
  LlmFunctionCallContract,
  LlmStreamingContract,
  LlmResponseNormalizerContract,
  LlmErrorModelContract,
  LlmRetryStrategyContract,
  LlmTimeoutStrategyContract,
  LlmCostModelContract,
  LlmTokenAccountingContract,
  LlmProviderSelectionContract,
  LlmProviderRankingContract,
  LlmEventContract,
  LlmAnalyticsContract,
  LlmAuditEntry,
  LlmAuditTrailContract,
  LlmStateTransition,
  LlmStateMachineContract,
  LlmAdapterBlueprint,
} from './types'

export {
  LLM_ADAPTER_ISOLATION,
  LLM_REQUEST_PIPELINE_STAGES,
  LLM_RESPONSE_PIPELINE_STAGES,
  LLM_STATE_IDS,
  LLM_FUTURE_PROVIDERS,
} from './types'

export {
  buildLlmAdapter,
  buildLlmProviderInterface,
  buildLlmProviderContracts,
  buildLlmRequestPipeline,
  buildLlmResponsePipeline,
  buildLlmContextBuilder,
  buildLlmPromptBuilder,
  buildLlmSystemPrompt,
  buildLlmToolCall,
  buildLlmFunctionCall,
  buildLlmStreaming,
  buildLlmResponseNormalizer,
  buildLlmErrorModel,
  buildLlmRetryStrategy,
  buildLlmTimeoutStrategy,
  buildLlmCostModel,
  buildLlmTokenAccounting,
  buildLlmProviderSelection,
  buildLlmProviderRanking,
  buildLlmEvent,
  buildLlmAnalytics,
  buildLlmAuditTrail,
  buildLlmStateMachine,
} from './pipelines'

export {
  LlmAdapter,
  buildLlmAdapterBlueprint,
  tryBuildLlmAdapterBlueprint,
  assertLlmAdapterIsolation,
} from './engine'
export type { BuildLlmAdapterBlueprintOptions } from './engine'

export const LLM_ADAPTER_ARCHITECTURE = {
  version: '6.8.0-llm-adapter',
  featureId: 'brain.llm_adapter' as const,
  architectureOnly: true,
  components: [
    'llm_adapter',
    'llm_registry',
    'llm_provider_contracts',
    'llm_provider_interface',
    'llm_request_pipeline',
    'llm_response_pipeline',
    'llm_context_builder',
    'llm_prompt_builder',
    'llm_system_prompt',
    'llm_tool_call',
    'llm_function_call',
    'llm_streaming',
    'llm_response_normalizer',
    'llm_error_model',
    'llm_retry_strategy',
    'llm_timeout_strategy',
    'llm_cost_model',
    'llm_token_accounting',
    'llm_provider_selection',
    'llm_provider_ranking',
    'llm_analytics',
    'llm_audit_trail',
    'llm_events',
    'llm_state_machine',
  ] as const,
  requestPipelineStages: LLM_REQUEST_PIPELINE_STAGES,
  responsePipelineStages: LLM_RESPONSE_PIPELINE_STAGES,
  futureProviders: LLM_FUTURE_PROVIDERS,
  ...LA_ISOLATION,
} as const
