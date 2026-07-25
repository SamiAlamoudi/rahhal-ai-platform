/**
 * LLM Adapter facade — builds architecture blueprints only.
 * Never calls providers, SDKs, or HTTP.
 */

import { listLlmRegistry } from './registry'
import { isBrainLlmAdapterEnabled } from './registry'
import {
  buildLlmAdapter,
  buildLlmAnalytics,
  buildLlmAuditTrail,
  buildLlmContextBuilder,
  buildLlmCostModel,
  buildLlmErrorModel,
  buildLlmEvent,
  buildLlmFunctionCall,
  buildLlmPromptBuilder,
  buildLlmProviderContracts,
  buildLlmProviderInterface,
  buildLlmProviderRanking,
  buildLlmProviderSelection,
  buildLlmRequestPipeline,
  buildLlmResponseNormalizer,
  buildLlmResponsePipeline,
  buildLlmRetryStrategy,
  buildLlmStateMachine,
  buildLlmStreaming,
  buildLlmSystemPrompt,
  buildLlmTimeoutStrategy,
  buildLlmTokenAccounting,
  buildLlmToolCall,
} from './pipelines'
import type { LlmAdapterBlueprint, LlmLocale } from './types'
import { LLM_ADAPTER_ISOLATION, LLM_FUTURE_PROVIDERS } from './types'

export interface BuildLlmAdapterBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: LlmLocale
}

export function buildLlmAdapterBlueprint(
  options: BuildLlmAdapterBlueprintOptions = {},
): LlmAdapterBlueprint {
  const sessionId = options.sessionId ?? 'llm-session-architecture'
  const locale = options.locale ?? 'ar'

  return {
    version: '6.8.0-llm-adapter',
    featureId: 'brain.llm_adapter',
    architectureOnly: true,
    adapter: buildLlmAdapter(),
    providerInterface: buildLlmProviderInterface(),
    providerContracts: buildLlmProviderContracts(),
    registry: listLlmRegistry(),
    requestPipeline: buildLlmRequestPipeline(),
    responsePipeline: buildLlmResponsePipeline(),
    contextBuilder: buildLlmContextBuilder(sessionId),
    promptBuilder: buildLlmPromptBuilder(),
    systemPrompt: buildLlmSystemPrompt(locale),
    toolCall: buildLlmToolCall(),
    functionCall: buildLlmFunctionCall(),
    streaming: buildLlmStreaming(),
    responseNormalizer: buildLlmResponseNormalizer(),
    errorModel: buildLlmErrorModel(),
    retryStrategy: buildLlmRetryStrategy(),
    timeoutStrategy: buildLlmTimeoutStrategy(),
    costModel: buildLlmCostModel(),
    tokenAccounting: buildLlmTokenAccounting(),
    providerSelection: buildLlmProviderSelection(),
    providerRanking: buildLlmProviderRanking(),
    events: [
      buildLlmEvent(sessionId, 'session_started', 'architecture blueprint'),
      buildLlmEvent(sessionId, 'provider_ranked', 'catalog ranking'),
    ],
    analytics: buildLlmAnalytics(sessionId),
    auditTrail: buildLlmAuditTrail(),
    stateMachine: buildLlmStateMachine(),
    futureProviders: LLM_FUTURE_PROVIDERS,
  }
}

export function tryBuildLlmAdapterBlueprint(
  options: BuildLlmAdapterBlueprintOptions = {},
): LlmAdapterBlueprint | null {
  if (!isBrainLlmAdapterEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildLlmAdapterBlueprint(options)
}

export function assertLlmAdapterIsolation(): typeof LLM_ADAPTER_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
  providerCount: number
} {
  return {
    ...LLM_ADAPTER_ISOLATION,
    architectureOnly: true,
    registrySize: listLlmRegistry().length,
    providerCount: LLM_FUTURE_PROVIDERS.length,
  }
}

export const LlmAdapter = {
  buildBlueprint: buildLlmAdapterBlueprint,
  tryBuildBlueprint: tryBuildLlmAdapterBlueprint,
  assertIsolation: assertLlmAdapterIsolation,
}
