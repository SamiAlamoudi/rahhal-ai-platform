/**
 * OpenAI chat completions adapter for Conversation Brain.
 * Enabled when VITE_OPENAI_API_KEY (or VITE_AGENT_OPENAI_API_KEY) is set.
 */

import type {
  AgentLlmProvider,
  AgentLlmResponse,
  ConversationLlmRequest,
  ConversationLlmResponse,
} from './types'

import { readManagedConfig, readManagedEnv } from '../../security/secrets/managedAccess'

function readOpenAiKey(): string | null {
  const raw = (
    readManagedEnv('OPENAI_API_KEY', { providerId: 'openai' })
    ?? readManagedConfig('VITE_AGENT_OPENAI_API_KEY')
    ?? readManagedConfig('VITE_OPENAI_API_KEY')
  )?.trim()
  return raw || null
}

function readOpenAiModel(): string {
  return (
    readManagedConfig('VITE_AGENT_OPENAI_MODEL')?.trim()
    || 'gpt-4o-mini'
  )
}

function readOpenAiBaseUrl(): string {
  return (
    readManagedConfig('VITE_AGENT_OPENAI_BASE_URL')?.trim()
    || 'https://api.openai.com/v1'
  )
}

export function createOpenAiAgentLlmAdapter(): AgentLlmProvider {
  return {
    providerId: 'openai',
    isAvailable: () => Boolean(readOpenAiKey()),
    async complete(request): Promise<AgentLlmResponse> {
      if (!readOpenAiKey()) {
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
      const apiKey = readOpenAiKey()
      if (!apiKey) {
        return {
          providerId: 'openai',
          status: 'unavailable',
          text: '',
          error: 'missing_api_key',
        }
      }
      try {
        const body = {
          model: readOpenAiModel(),
          temperature: request.temperature ?? 0.85,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: request.systemPrompt },
            ...request.messages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }
        const res = await fetch(`${readOpenAiBaseUrl()}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: request.signal,
        })
        if (!res.ok) {
          const errText = await res.text().catch(() => '')
          return {
            providerId: 'openai',
            status: 'error',
            text: '',
            error: `http_${res.status}:${errText.slice(0, 200)}`,
          }
        }
        const data = await res.json() as {
          choices?: Array<{ message?: { content?: string } }>
        }
        const text = data.choices?.[0]?.message?.content?.trim() ?? ''
        if (!text) {
          return { providerId: 'openai', status: 'error', text: '', error: 'empty_completion' }
        }
        return { providerId: 'openai', status: 'ok', text }
      } catch (error) {
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
