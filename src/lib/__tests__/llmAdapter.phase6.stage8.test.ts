/**
 * Phase 6 Stage 8 — AI LLM Adapter Layer architecture tests.
 * Contracts/blueprints only. No SDKs / API keys / HTTP / Runtime.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_LLM_ADAPTER_FEATURE_ID,
  LLM_ADAPTER_ARCHITECTURE,
  LLM_FUTURE_PROVIDERS,
  LLM_REQUEST_PIPELINE_STAGES,
  LLM_RESPONSE_PIPELINE_STAGES,
  LlmAdapter,
  LlmRegistry,
  assertLlmAdapterIsolation,
  buildLlmAdapterBlueprint,
  isBrainLlmAdapterEnabled,
  tryBuildLlmAdapterBlueprint,
} from '../orchestration/llmAdapter'

describe('Phase 6 Stage 8 — AI LLM Adapter Layer (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.llm_adapter default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_LLM_ADAPTER_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.tool_engine'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_LLM_ADAPTER_FEATURE_ID),
      ).toBe(false)
      expect(isBrainLlmAdapterEnabled()).toBe(false)
      expect(tryBuildLlmAdapterBlueprint({})).toBeNull()
      expect(LLM_ADAPTER_ARCHITECTURE.wiredIntoProviderSdks).toBe(false)
      expect(LLM_ADAPTER_ARCHITECTURE.wiredIntoOpenAiSdk).toBe(false)
      expect(LLM_ADAPTER_ARCHITECTURE.wiredIntoClaudeSdk).toBe(false)
      expect(LLM_ADAPTER_ARCHITECTURE.wiredIntoGeminiSdk).toBe(false)
      expect(LLM_ADAPTER_ARCHITECTURE.apiKeysPresent).toBe(false)
      expect(LLM_ADAPTER_ARCHITECTURE.httpRequests).toBe(false)
      expect(LLM_ADAPTER_ARCHITECTURE.streamingImplemented).toBe(false)
      expect(LLM_ADAPTER_ARCHITECTURE.wiredIntoFirebase).toBe(false)
      expect(LLM_ADAPTER_ARCHITECTURE.wiredIntoSupabase).toBe(false)
      expect(LLM_ADAPTER_ARCHITECTURE.wiredIntoRedis).toBe(false)
      expect(LLM_ADAPTER_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(LLM_ADAPTER_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(LLM_ADAPTER_ARCHITECTURE.businessLogic).toBe(false)
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p6s8',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p6s8',
            role: 'user',
            modality: 'text',
            content: 'Hello',
            audioUrl: null,
            imageUrl: null,
            attachments: [],
            status: 'complete',
            error: null,
            providerMeta: {},
            createdAt: '2026-07-25T00:00:00.000Z',
            updatedAt: '2026-07-25T00:00:00.000Z',
          },
        ],
      })
      expect(turn.reply.length).toBeGreaterThan(0)
      expect(turn.meta.experience).toBeUndefined()
    })
  })

  describe('contracts inventory', () => {
    it('exposes registry, providers, and pipelines', () => {
      expect(assertLlmAdapterIsolation().architectureOnly).toBe(true)
      expect(LlmRegistry.list()).toHaveLength(LLM_FUTURE_PROVIDERS.length)
      expect(LLM_FUTURE_PROVIDERS).toEqual(
        expect.arrayContaining([
          'openai',
          'claude',
          'gemini',
          'azure_openai',
          'openrouter',
          'local_models',
          'future_providers',
        ]),
      )
      expect(LLM_REQUEST_PIPELINE_STAGES).toContain('select_provider')
      expect(LLM_REQUEST_PIPELINE_STAGES).toContain('build_prompt')
      expect(LLM_RESPONSE_PIPELINE_STAGES).toContain('normalize_response')
      expect(LLM_RESPONSE_PIPELINE_STAGES).toContain('account_tokens')
      expect(LLM_ADAPTER_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'llm_adapter',
          'llm_registry',
          'llm_provider_interface',
          'llm_request_pipeline',
          'llm_response_pipeline',
          'llm_cost_model',
          'llm_audit_trail',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildLlmAdapterBlueprint({
        enabled: true,
        sessionId: 'l-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.adapter.execution).toBe('none')
      expect(blueprint?.requestPipeline.execution).toBe('none')
      expect(blueprint?.responsePipeline.execution).toBe('none')
      expect(
        blueprint?.providerContracts.every((p) => p.execution === 'none'),
      ).toBe(true)
      expect(blueprint?.streaming.streamingSupportedHint).toBe(false)
      expect(blueprint?.providerSelection.selectedProviderId).toBeNull()
      expect(blueprint?.tokenAccounting.metered).toBe(false)
      expect(blueprint?.costModel.estimated).toBe(false)
      expect(blueprint?.retryStrategy.maxAttemptsHint).toBe(0)
      expect(blueprint?.timeoutStrategy.timeoutMsHint).toBe(0)
      expect(blueprint?.analytics.exported).toBe(false)
      expect(blueprint?.auditTrail.persisted).toBe(false)
      expect(blueprint?.stateMachine.current).toBe('idle')
      expect(blueprint?.futureProviders).toHaveLength(
        LLM_FUTURE_PROVIDERS.length,
      )

      const direct = buildLlmAdapterBlueprint({ sessionId: 'l2' })
      expect(direct.version).toBe('6.8.0-llm-adapter')
      expect(LlmAdapter.tryBuildBlueprint({ enabled: false })).toBeNull()
    })
  })
})
