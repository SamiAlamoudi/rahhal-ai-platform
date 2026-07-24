/**
 * OpenAI chat completions adapter for Conversation Brain.
 *
 * Privileged OpenAI calls go through the `openai-proxy` Edge Function.
 * The SPA never ships `VITE_OPENAI_*` / `VITE_AGENT_OPENAI_API_KEY` secrets.
 *
 * Availability (browser):
 *   VITE_OPENAI_PROXY_URL (or default `${VITE_SUPABASE_URL}/functions/v1/openai-proxy`)
 *   + VITE_SUPABASE_ANON_KEY
 *   + VITE_AGENT_LLM_PROVIDER=openai (or auto when proxy is configured)
 *
 * Server/tests may still set process.env.OPENAI_API_KEY for direct calls.
 */

import type {
  AgentLlmProvider,
  AgentLlmResponse,
  ConversationLlmRequest,
  ConversationLlmResponse,
} from './types'

function readViteEnv(key: string): string | null {
  try {
    const value = (import.meta.env as Record<string, unknown>)[key]
    if (value === undefined || value === null || value === '') return null
    return String(value).trim() || null
  } catch {
    return null
  }
}

function readProcessEnv(key: string): string | null {
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    const value = proc?.env?.[key]
    if (value === undefined || value === null || value === '') return null
    return String(value).trim() || null
  } catch {
    return null
  }
}

/** Server-only direct key (Node / Edge tests). Never from VITE_*. */
function readServerOpenAiKey(): string | null {
  return readProcessEnv('OPENAI_API_KEY') ?? readProcessEnv('AGENT_OPENAI_API_KEY')
}

function readOpenAiModel(): string {
  return (
    readViteEnv('VITE_AGENT_OPENAI_MODEL')
    || readProcessEnv('OPENAI_MODEL')
    || 'gpt-4o-mini'
  )
}

function readOpenAiProxyUrl(): string | null {
  const explicit = readViteEnv('VITE_OPENAI_PROXY_URL') || readProcessEnv('OPENAI_PROXY_URL')
  if (explicit) return explicit.replace(/\/$/, '')
  // Default Edge path only when LLM provider is explicitly openai.
  const provider = (
    readViteEnv('VITE_AGENT_LLM_PROVIDER') || readProcessEnv('AGENT_LLM_PROVIDER') || ''
  ).toLowerCase()
  if (provider !== 'openai') return null
  const supabaseUrl = readViteEnv('VITE_SUPABASE_URL')
  if (!supabaseUrl) return null
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/openai-proxy`
}

function readInvokeApiKey(): string | null {
  return (
    readViteEnv('VITE_SUPABASE_ANON_KEY')
    || readViteEnv('VITE_SUPABASE_PUBLISHABLE_KEY')
    || readProcessEnv('OPENAI_INVOKE_KEY')
  )
}

function readDirectBaseUrl(): string {
  return (
    readProcessEnv('OPENAI_BASE_URL')
    || 'https://api.openai.com/v1'
  ).replace(/\/$/, '')
}

export function isOpenAiProxyConfigured(): boolean {
  return Boolean(readOpenAiProxyUrl() && readInvokeApiKey())
}

export function isOpenAiAdapterAvailable(): boolean {
  return Boolean(readServerOpenAiKey() || isOpenAiProxyConfigured())
}

export function createOpenAiAgentLlmAdapter(): AgentLlmProvider {
  return {
    providerId: 'openai',
    isAvailable: () => isOpenAiAdapterAvailable(),
    async complete(request): Promise<AgentLlmResponse> {
      if (!isOpenAiAdapterAvailable()) {
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
      if (!isOpenAiAdapterAvailable()) {
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

        const proxyUrl = readOpenAiProxyUrl()
        const invokeKey = readInvokeApiKey()
        const serverKey = readServerOpenAiKey()

        let res: Response
        if (proxyUrl && invokeKey) {
          res = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${invokeKey}`,
              apikey: invokeKey,
            },
            body: JSON.stringify(body),
            signal: request.signal,
          })
        } else if (serverKey) {
          res = await fetch(`${readDirectBaseUrl()}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serverKey}`,
            },
            body: JSON.stringify(body),
            signal: request.signal,
          })
        } else {
          return {
            providerId: 'openai',
            status: 'unavailable',
            text: '',
            error: 'missing_api_key',
          }
        }

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
