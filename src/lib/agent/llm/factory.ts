import type { AgentLlmProvider, AgentLlmProviderId, AgentLlmRegistry } from './types'
import { createLocalAgentLlmAdapter } from './localLlmAdapter'
import { createOpenAiAgentLlmAdapter } from './openaiLlmAdapter'
import {
  createAnthropicAgentLlmAdapter,
  createDeepSeekAgentLlmAdapter,
  createGeminiAgentLlmAdapter,
} from './stubLlmAdapters'
import { isOpenAiConfigured } from './openaiClient'

import { readManagedConfig } from '../../security/secrets/managedAccess'

/**
 * Conversation-First selection:
 * - If an OpenAI API key is present → OpenAI (unless another remote provider id is forced).
 * - Otherwise → local fallback (or explicit remote stub id).
 * Adding VITE_OPENAI_API_KEY / VITE_AGENT_OPENAI_API_KEY is enough to go live.
 */
export function getDefaultAgentLlmProviderId(): AgentLlmProviderId {
  const raw = readManagedConfig('VITE_AGENT_LLM_PROVIDER')?.trim().toLowerCase()
  if (isOpenAiConfigured()) {
    if (raw === 'anthropic' || raw === 'gemini' || raw === 'deepseek') return raw
    return 'openai'
  }
  if (raw === 'openai' || raw === 'anthropic' || raw === 'gemini' || raw === 'deepseek' || raw === 'local') {
    return raw
  }
  return 'local'
}

export function createAgentLlmProvider(
  type: AgentLlmProviderId = getDefaultAgentLlmProviderId(),
): AgentLlmProvider {
  switch (type) {
    case 'openai':
      return createOpenAiAgentLlmAdapter()
    case 'anthropic':
      return createAnthropicAgentLlmAdapter()
    case 'gemini':
      return createGeminiAgentLlmAdapter()
    case 'deepseek':
      return createDeepSeekAgentLlmAdapter()
    case 'local':
    default:
      return createLocalAgentLlmAdapter()
  }
}

export function createAgentLlmRegistry(
  activeId: AgentLlmProviderId = getDefaultAgentLlmProviderId(),
): AgentLlmRegistry {
  const providers: AgentLlmProvider[] = [
    createLocalAgentLlmAdapter(),
    createOpenAiAgentLlmAdapter(),
    createAnthropicAgentLlmAdapter(),
    createGeminiAgentLlmAdapter(),
    createDeepSeekAgentLlmAdapter(),
  ]
  const map = new Map(providers.map((p) => [p.providerId, p]))

  return {
    list() {
      return [...map.keys()]
    },
    get(id) {
      return map.get(id)
    },
    getActive() {
      // Conversation-First: OpenAI wins whenever a key is configured.
      const openai = map.get('openai')
      if (openai?.isAvailable()) return openai
      const preferred = map.get(activeId)
      if (preferred?.isAvailable()) return preferred
      return map.get('local') ?? createLocalAgentLlmAdapter()
    },
  }
}
