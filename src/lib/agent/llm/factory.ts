import type { AgentLlmProvider, AgentLlmProviderId, AgentLlmRegistry } from './types'
import { createLocalAgentLlmAdapter } from './localLlmAdapter'
import { createOpenAiAgentLlmAdapter } from './openaiLlmAdapter'
import {
  createAnthropicAgentLlmAdapter,
  createDeepSeekAgentLlmAdapter,
  createGeminiAgentLlmAdapter,
} from './stubLlmAdapters'

import { readManagedConfig, readManagedEnv } from '../../security/secrets/managedAccess'

export function getDefaultAgentLlmProviderId(): AgentLlmProviderId {
  const raw = readManagedConfig('VITE_AGENT_LLM_PROVIDER')?.trim().toLowerCase()
  if (raw === 'openai' || raw === 'anthropic' || raw === 'gemini' || raw === 'deepseek' || raw === 'local') {
    return raw
  }
  // Prefer OpenAI automatically when a key is present.
  const key = (
    readManagedEnv('OPENAI_API_KEY', { providerId: 'openai' })
    ?? readManagedConfig('VITE_AGENT_OPENAI_API_KEY')
    ?? readManagedConfig('VITE_OPENAI_API_KEY')
  )?.trim()
  if (key) return 'openai'
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
      // OpenAI preferred over local when available even if activeId was local.
      const openai = map.get('openai')
      if (openai?.isAvailable()) return openai
      return map.get('local') ?? createLocalAgentLlmAdapter()
    },
  }
}
