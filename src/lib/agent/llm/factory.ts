import type { AgentLlmProvider, AgentLlmProviderId, AgentLlmRegistry } from './types'
import { createLocalAgentLlmAdapter } from './localLlmAdapter'
import {
  createAnthropicAgentLlmAdapter,
  createDeepSeekAgentLlmAdapter,
  createGeminiAgentLlmAdapter,
  createOpenAiAgentLlmAdapter,
} from './stubLlmAdapters'

export function getDefaultAgentLlmProviderId(): AgentLlmProviderId {
  const raw = (import.meta.env.VITE_AGENT_LLM_PROVIDER as string | undefined)?.trim().toLowerCase()
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
      const preferred = map.get(activeId)
      if (preferred?.isAvailable()) return preferred
      return map.get('local') ?? createLocalAgentLlmAdapter()
    },
  }
}
