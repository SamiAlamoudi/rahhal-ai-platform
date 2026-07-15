import type { AgentLlmProvider, AgentLlmProviderId } from './types'

function createUnavailableAdapter(providerId: Exclude<AgentLlmProviderId, 'local'>): AgentLlmProvider {
  return {
    providerId,
    isAvailable: () => false,
    async complete() {
      return {
        providerId,
        status: 'unavailable',
        draft: null,
        assistantHint: `${providerId} adapter is registered but not configured (foundation: interfaces only)`,
      }
    },
  }
}

/** Future remote LLM adapters — interfaces only, no network calls. */
export function createOpenAiAgentLlmAdapter(): AgentLlmProvider {
  return createUnavailableAdapter('openai')
}

export function createAnthropicAgentLlmAdapter(): AgentLlmProvider {
  return createUnavailableAdapter('anthropic')
}

export function createGeminiAgentLlmAdapter(): AgentLlmProvider {
  return createUnavailableAdapter('gemini')
}

export function createDeepSeekAgentLlmAdapter(): AgentLlmProvider {
  return createUnavailableAdapter('deepseek')
}
