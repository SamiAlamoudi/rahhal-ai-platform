import type {
  AgentLlmProvider,
  AgentLlmProviderId,
  ConversationLlmRequest,
  ConversationLlmResponse,
} from './types'

function createUnavailableAdapter(providerId: Exclude<AgentLlmProviderId, 'local' | 'openai'>): AgentLlmProvider {
  return {
    providerId,
    isAvailable: () => false,
    async complete() {
      return {
        providerId,
        status: 'unavailable',
        draft: null,
        assistantHint: `${providerId} adapter is registered but not configured`,
      }
    },
    async converse(_request: ConversationLlmRequest): Promise<ConversationLlmResponse> {
      return {
        providerId,
        status: 'unavailable',
        text: '',
        error: 'not_configured',
      }
    },
  }
}

/** Future remote LLM adapters — interfaces only until keys are wired. */
export function createAnthropicAgentLlmAdapter(): AgentLlmProvider {
  return createUnavailableAdapter('anthropic')
}

export function createGeminiAgentLlmAdapter(): AgentLlmProvider {
  return createUnavailableAdapter('gemini')
}

export function createDeepSeekAgentLlmAdapter(): AgentLlmProvider {
  return createUnavailableAdapter('deepseek')
}
