/**
 * OpenAI chat completions adapter for Conversation Brain.
 * Enabled when server OPENAI_API_KEY is configured (browser uses /api/openai/*).
 * Client VITE_OPENAI_* keys are forbidden in production (Sprint 79 P0).
 * Never hardcodes secrets — all config is environment-driven via openaiClient.
 */

import type {
  AgentLlmProvider,
  AgentLlmResponse,
  ConversationLlmRequest,
  ConversationLlmResponse,
} from './types'
import {
  isOpenAiConfigured,
  openAiChatCompletion,
  OpenAiClientError,
} from './openaiClient'

export function createOpenAiAgentLlmAdapter(): AgentLlmProvider {
  return {
    providerId: 'openai',
    isAvailable: () => isOpenAiConfigured(),
    async complete(request): Promise<AgentLlmResponse> {
      if (!isOpenAiConfigured()) {
        return {
          providerId: 'openai',
          status: 'unavailable',
          draft: null,
          assistantHint: 'openai adapter is not configured',
        }
      }
      // Plan drafts stay deterministic in Travel Intelligence; converse() owns dialogue.
      return {
        providerId: 'openai',
        status: 'ok',
        draft: {
          summary: request.memory.requirements.destination
            ? `OpenAI-aware planner for ${request.memory.requirements.destination}`
            : 'OpenAI-aware planner',
          notes: [],
        },
        assistantHint: null,
      }
    },
    async converse(request: ConversationLlmRequest): Promise<ConversationLlmResponse> {
      if (!isOpenAiConfigured()) {
        return {
          providerId: 'openai',
          status: 'unavailable',
          text: '',
          error: 'missing_api_key',
        }
      }
      try {
        const result = await openAiChatCompletion({
          temperature: request.temperature ?? 0.9,
          // ChatGPT Voice parity: natural prose, not JSON wrappers.
          jsonObject: false,
          stream: request.stream !== false,
          signal: request.signal,
          onDelta: request.onDelta
            ? (accumulated) => {
              request.onDelta?.(accumulated)
            }
            : undefined,
          messages: [
            { role: 'system', content: request.systemPrompt },
            ...request.messages.map((m) => ({ role: m.role, content: m.content })),
          ],
        })
        return {
          providerId: 'openai',
          status: 'ok',
          text: result.text,
          usage: result.usage,
        }
      } catch (error) {
        if (error instanceof OpenAiClientError) {
          return {
            providerId: 'openai',
            status: error.code === 'missing_api_key' ? 'unavailable' : 'error',
            text: '',
            error: error.code === 'http_error' && error.httpStatus
              ? `http_${error.httpStatus}:${error.message}`
              : error.code,
          }
        }
        if (request.signal?.aborted) {
          return { providerId: 'openai', status: 'error', text: '', error: 'aborted' }
        }
        return {
          providerId: 'openai',
          status: 'error',
          text: '',
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}
