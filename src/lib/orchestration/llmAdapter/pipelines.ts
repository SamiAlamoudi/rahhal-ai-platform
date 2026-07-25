/**
 * LLM adapter pipelines & component contracts — pure builders, no execution.
 */

import type {
  LlmAdapterContract,
  LlmAnalyticsContract,
  LlmAuditTrailContract,
  LlmContextBuilderContract,
  LlmCostModelContract,
  LlmErrorModelContract,
  LlmEventContract,
  LlmFunctionCallContract,
  LlmLocale,
  LlmPromptBuilderContract,
  LlmProviderContract,
  LlmProviderInterfaceContract,
  LlmProviderRankingContract,
  LlmProviderSelectionContract,
  LlmRequestPipelineContract,
  LlmResponseNormalizerContract,
  LlmResponsePipelineContract,
  LlmRetryStrategyContract,
  LlmStateMachineContract,
  LlmStreamingContract,
  LlmSystemPromptContract,
  LlmTimeoutStrategyContract,
  LlmTokenAccountingContract,
  LlmToolCallContract,
} from './types'
import {
  LLM_FUTURE_PROVIDERS,
  LLM_REQUEST_PIPELINE_STAGES,
  LLM_RESPONSE_PIPELINE_STAGES,
  LLM_STATE_IDS,
} from './types'

const ISO = '2026-07-25T00:00:00.000Z'

export function buildLlmAdapter(): LlmAdapterContract {
  return {
    kind: 'llm_adapter',
    version: '6.8.0-llm-adapter',
    execution: 'none',
  }
}

export function buildLlmProviderInterface(): LlmProviderInterfaceContract {
  return {
    kind: 'llm_provider_interface',
    methods: [
      'prepareRequest',
      'prepareResponse',
      'normalize',
      'accountTokens',
      'hintCost',
    ],
    execution: 'none',
  }
}

export function buildLlmProviderContracts(): LlmProviderContract[] {
  return LLM_FUTURE_PROVIDERS.map((providerId) => ({
    kind: 'llm_provider_contract' as const,
    providerId,
    label: providerId,
    capabilitiesHint: ['chat_placeholder', 'no_sdk'],
    execution: 'none' as const,
  }))
}

export function buildLlmRequestPipeline(): LlmRequestPipelineContract {
  return {
    kind: 'llm_request_pipeline',
    stages: LLM_REQUEST_PIPELINE_STAGES,
    execution: 'none',
  }
}

export function buildLlmResponsePipeline(): LlmResponsePipelineContract {
  return {
    kind: 'llm_response_pipeline',
    stages: LLM_RESPONSE_PIPELINE_STAGES,
    execution: 'none',
  }
}

export function buildLlmContextBuilder(
  sessionId: string,
): LlmContextBuilderContract {
  return {
    kind: 'llm_context_builder',
    sessionId,
    contextKeys: [],
    execution: 'none',
  }
}

export function buildLlmPromptBuilder(): LlmPromptBuilderContract {
  return {
    kind: 'llm_prompt_builder',
    promptShapeHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildLlmSystemPrompt(
  locale: LlmLocale = 'ar',
): LlmSystemPromptContract {
  return {
    kind: 'llm_system_prompt',
    templateId: 'system-architecture',
    locale,
    execution: 'none',
  }
}

export function buildLlmToolCall(): LlmToolCallContract {
  return {
    kind: 'llm_tool_call',
    toolCallSchemaHint: 'tool_call.architecture',
    execution: 'none',
  }
}

export function buildLlmFunctionCall(): LlmFunctionCallContract {
  return {
    kind: 'llm_function_call',
    functionCallSchemaHint: 'function_call.architecture',
    execution: 'none',
  }
}

export function buildLlmStreaming(): LlmStreamingContract {
  return {
    kind: 'llm_streaming',
    streamingSupportedHint: false,
    execution: 'none',
  }
}

export function buildLlmResponseNormalizer(): LlmResponseNormalizerContract {
  return {
    kind: 'llm_response_normalizer',
    normalizedShapeHint: 'provider_agnostic_placeholder',
    execution: 'none',
  }
}

export function buildLlmErrorModel(): LlmErrorModelContract {
  return {
    kind: 'llm_error_model',
    codes: [
      'LLM_NOT_IMPLEMENTED',
      'LLM_PROVIDER_DENIED',
      'LLM_TIMEOUT_HINT',
    ],
    retryableHints: ['LLM_TIMEOUT_HINT'],
    execution: 'none',
  }
}

export function buildLlmRetryStrategy(): LlmRetryStrategyContract {
  return {
    kind: 'llm_retry_strategy',
    maxAttemptsHint: 0,
    backoffHint: 'none',
    execution: 'none',
  }
}

export function buildLlmTimeoutStrategy(): LlmTimeoutStrategyContract {
  return {
    kind: 'llm_timeout_strategy',
    timeoutMsHint: 0,
    execution: 'none',
  }
}

export function buildLlmCostModel(): LlmCostModelContract {
  return {
    kind: 'llm_cost_model',
    currencyHint: 'USD',
    unitHint: 'token_placeholder',
    estimated: false,
    execution: 'none',
  }
}

export function buildLlmTokenAccounting(): LlmTokenAccountingContract {
  return {
    kind: 'llm_token_accounting',
    promptTokensHint: 0,
    completionTokensHint: 0,
    totalTokensHint: 0,
    metered: false,
    execution: 'none',
  }
}

export function buildLlmProviderSelection(): LlmProviderSelectionContract {
  return {
    kind: 'llm_provider_selection',
    selectedProviderId: null,
    reasonHint: 'architecture_only',
    execution: 'none',
  }
}

export function buildLlmProviderRanking(): LlmProviderRankingContract {
  return {
    kind: 'llm_provider_ranking',
    ranked: LLM_FUTURE_PROVIDERS.map((providerId, index) => ({
      providerId,
      scoreHint: LLM_FUTURE_PROVIDERS.length - index,
    })),
    execution: 'none',
  }
}

export function buildLlmEvent(
  sessionId: string,
  eventKind: LlmEventContract['eventKind'],
  payloadSummary: string,
): LlmEventContract {
  return {
    kind: 'llm_event',
    eventId: `levt-${eventKind}`,
    eventKind,
    sessionId,
    atIso: ISO,
    payloadSummary,
  }
}

export function buildLlmAnalytics(sessionId: string): LlmAnalyticsContract {
  return {
    kind: 'llm_analytics',
    sessionId,
    providerCount: LLM_FUTURE_PROVIDERS.length,
    requestStageCount: LLM_REQUEST_PIPELINE_STAGES.length,
    responseStageCount: LLM_RESPONSE_PIPELINE_STAGES.length,
    exported: false,
  }
}

export function buildLlmAuditTrail(): LlmAuditTrailContract {
  return {
    kind: 'llm_audit_trail',
    entries: [
      {
        id: 'laudit-open',
        atIso: ISO,
        action: 'session_started',
        detail: 'architecture blueprint',
      },
    ],
    persisted: false,
  }
}

export function buildLlmStateMachine(): LlmStateMachineContract {
  return {
    kind: 'llm_state_machine',
    current: 'idle',
    allowed: LLM_STATE_IDS,
    lastTransition: null,
    execution: 'none',
  }
}
