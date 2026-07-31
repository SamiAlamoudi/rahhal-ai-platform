/**
 * Production OpenAI Chat Completions client for Conversation-First Rahhal.
 * Keys and tunables come only from environment (via managedAccess) — never hardcoded.
 */

import { readManagedConfig, readManagedEnv } from '../../security/secrets/managedAccess'
import { logChat } from '../../chat/chatLogger'

export type OpenAiChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type OpenAiTokenUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type OpenAiChatResult = {
  text: string
  model: string
  usage: OpenAiTokenUsage | null
  finishReason: string | null
}

export type OpenAiClientErrorCode =
  | 'missing_api_key'
  | 'timeout'
  | 'aborted'
  | 'http_error'
  | 'network_error'
  | 'empty_completion'
  | 'invalid_response'

export class OpenAiClientError extends Error {
  readonly code: OpenAiClientErrorCode
  readonly httpStatus?: number
  readonly retryable: boolean

  constructor(
    code: OpenAiClientErrorCode,
    message: string,
    options?: { httpStatus?: number; retryable?: boolean; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'OpenAiClientError'
    this.code = code
    this.httpStatus = options?.httpStatus
    this.retryable = options?.retryable ?? false
  }
}

export type OpenAiClientConfig = {
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs: number
  maxRetries: number
  /** Soft ceiling for spoken / completion logging context only. */
  maxCompletionTokens: number | null
  /** Browser same-origin proxy (/api/openai/chat) — server holds the secret. */
  useProxy: boolean
}

export type OpenAiChatRequest = {
  messages: OpenAiChatMessage[]
  temperature?: number
  jsonObject?: boolean
  signal?: AbortSignal
  /** Incremental assistant text (streaming). */
  onDelta?: (accumulatedText: string, chunk: string) => void
  /** Prefer SSE streaming (default true). Falls back to non-stream on failure. */
  stream?: boolean
}

function readOpenAiApiKey(): string | null {
  // Browser live path uses same-origin /api/openai/* (server OPENAI_API_KEY only).
  // Never prefer VITE_* OpenAI keys — they must not ship in production bundles.
  if (typeof window !== 'undefined') return null
  const raw = readManagedEnv('OPENAI_API_KEY', { providerId: 'openai' })?.trim()
  return raw || null
}

function readPositiveInt(raw: string | null | undefined, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function preferBrowserProxy(): boolean {
  if (typeof window === 'undefined') return false
  const forced = readManagedConfig('VITE_AGENT_LLM_PROVIDER')?.trim().toLowerCase()
  if (forced === 'local') return false
  // Always prefer same-origin proxy in the browser so production works with
  // server-only OPENAI_API_KEY (no VITE_ key required in the SPA bundle).
  return true
}

export function resolveOpenAiClientConfig(): OpenAiClientConfig | null {
  const apiKey = readOpenAiApiKey()
  const useProxy = preferBrowserProxy()
  if (!apiKey && !useProxy) return null
  const maxTokensRaw = readManagedConfig('VITE_AGENT_OPENAI_MAX_TOKENS')?.trim()
  const maxCompletionTokens = maxTokensRaw ? readPositiveInt(maxTokensRaw, 0) || null : null
  return {
    apiKey: apiKey || 'proxy',
    baseUrl: (readManagedConfig('VITE_AGENT_OPENAI_BASE_URL')?.trim() || 'https://api.openai.com/v1').replace(/\/$/, ''),
    // Prefer gpt-4o for natural Arabic consultant quality (override via env).
    model: readManagedConfig('VITE_AGENT_OPENAI_MODEL')?.trim() || 'gpt-4o',
    timeoutMs: readPositiveInt(readManagedConfig('VITE_AGENT_OPENAI_TIMEOUT_MS'), 45_000),
    maxRetries: readPositiveInt(readManagedConfig('VITE_AGENT_OPENAI_MAX_RETRIES'), 2),
    maxCompletionTokens,
    useProxy,
  }
}

export function isOpenAiConfigured(): boolean {
  if (readOpenAiApiKey()) return true
  return preferBrowserProxy()
}

function mergeAbortSignals(signals: Array<AbortSignal | undefined>): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController()
  const onAbort = () => {
    if (!controller.signal.aborted) controller.abort()
  }
  const cleanups: Array<() => void> = []
  for (const signal of signals) {
    if (!signal) continue
    if (signal.aborted) {
      controller.abort()
      break
    }
    signal.addEventListener('abort', onAbort, { once: true })
    cleanups.push(() => signal.removeEventListener('abort', onAbort))
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      for (const c of cleanups) c()
    },
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new OpenAiClientError('aborted', 'Request aborted', { retryable: false }))
      return
    }
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new OpenAiClientError('aborted', 'Request aborted', { retryable: false }))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function parseUsage(raw: unknown): OpenAiTokenUsage | null {
  if (!raw || typeof raw !== 'object') return null
  const u = raw as Record<string, unknown>
  const promptTokens = Number(u.prompt_tokens ?? 0)
  const completionTokens = Number(u.completion_tokens ?? 0)
  const totalTokens = Number(u.total_tokens ?? promptTokens + completionTokens)
  if (![promptTokens, completionTokens, totalTokens].every((n) => Number.isFinite(n))) return null
  return {
    promptTokens,
    completionTokens,
    totalTokens,
  }
}

function logUsage(model: string, usage: OpenAiTokenUsage | null, meta?: Record<string, unknown>): void {
  logChat('debug', 'openai', 'token_usage', {
    model,
    promptTokens: usage?.promptTokens ?? null,
    completionTokens: usage?.completionTokens ?? null,
    totalTokens: usage?.totalTokens ?? null,
    ...meta,
  })
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

function buildRequestBody(
  config: OpenAiClientConfig,
  request: OpenAiChatRequest,
  stream: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: config.model,
    temperature: request.temperature ?? 0.85,
    messages: request.messages,
    stream,
  }
  if (request.jsonObject === true) {
    body.response_format = { type: 'json_object' }
  }
  if (config.maxCompletionTokens && config.maxCompletionTokens > 0) {
    body.max_tokens = config.maxCompletionTokens
  }
  if (stream) {
    body.stream_options = { include_usage: true }
  }
  return body
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  if (!text) return res.statusText || `http_${res.status}`
  try {
    const json = JSON.parse(text) as { error?: { message?: string } }
    if (json.error?.message) return json.error.message
  } catch {
    // plain text
  }
  return text.slice(0, 400)
}

async function fetchOnce(
  config: OpenAiClientConfig,
  request: OpenAiChatRequest,
  stream: boolean,
): Promise<Response> {
  const timeout = AbortSignal.timeout(config.timeoutMs)
  const { signal, cleanup } = mergeAbortSignals([request.signal, timeout])
  try {
    if (request.signal?.aborted) {
      throw new OpenAiClientError('aborted', 'Request aborted', { retryable: false })
    }
    const body = buildRequestBody(config, request, stream)
    if (config.useProxy) {
      // Same-origin Vercel Edge proxy — OpenAI secret stays on the server;
      // caller must present a real Supabase user JWT (Sprint 79 P0).
      const { requireProxyAuthHeaders } = await import('../../security/proxyAuth')
      const headers = await requireProxyAuthHeaders({ 'Content-Type': 'application/json' })
      return await fetch('/api/openai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: request.messages,
          temperature: request.temperature ?? 0.9,
          jsonObject: request.jsonObject === true,
          stream,
          model: config.model,
          max_tokens: config.maxCompletionTokens ?? undefined,
        }),
        signal,
      })
    }
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    })
    return res
  } catch (error) {
    if (request.signal?.aborted) {
      throw new OpenAiClientError('aborted', 'Request aborted', { retryable: false, cause: error })
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new OpenAiClientError('timeout', `OpenAI request timed out after ${config.timeoutMs}ms`, {
        retryable: true,
        cause: error,
      })
    }
    if (error instanceof OpenAiClientError) throw error
    const message = error instanceof Error ? error.message : String(error)
    if (/abort/i.test(message)) {
      throw new OpenAiClientError('aborted', 'Request aborted', { retryable: false, cause: error })
    }
    throw new OpenAiClientError('network_error', message, { retryable: true, cause: error })
  } finally {
    cleanup()
  }
}

async function withRetries<T>(
  config: OpenAiClientConfig,
  signal: AbortSignal | undefined,
  run: (attempt: number) => Promise<T>,
): Promise<T> {
  let lastError: unknown
  const attempts = Math.max(1, config.maxRetries + 1)
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (signal?.aborted) {
      throw new OpenAiClientError('aborted', 'Request aborted', { retryable: false })
    }
    try {
      return await run(attempt)
    } catch (error) {
      lastError = error
      const retryable = error instanceof OpenAiClientError ? error.retryable : true
      const isLast = attempt >= attempts - 1
      if (!retryable || isLast) throw error
      const backoffMs = Math.min(8_000, 400 * 2 ** attempt)
      logChat('warn', 'openai', 'retrying_request', {
        attempt: attempt + 1,
        backoffMs,
        code: error instanceof OpenAiClientError ? error.code : 'unknown',
        httpStatus: error instanceof OpenAiClientError ? error.httpStatus : undefined,
      })
      await sleep(backoffMs, signal)
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new OpenAiClientError('network_error', String(lastError), { retryable: false })
}

async function parseNonStreamResponse(res: Response, model: string): Promise<OpenAiChatResult> {
  if (!res.ok) {
    const detail = await readErrorMessage(res)
    throw new OpenAiClientError('http_error', `OpenAI HTTP ${res.status}: ${detail}`, {
      httpStatus: res.status,
      retryable: isRetryableStatus(res.status),
    })
  }
  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
    usage?: unknown
    model?: string
  }
  const text = data.choices?.[0]?.message?.content?.trim() ?? ''
  if (!text) {
    throw new OpenAiClientError('empty_completion', 'OpenAI returned an empty completion', {
      retryable: false,
    })
  }
  const usage = parseUsage(data.usage)
  const resolvedModel = data.model || model
  logUsage(resolvedModel, usage, { stream: false })
  return {
    text,
    model: resolvedModel,
    usage,
    finishReason: data.choices?.[0]?.finish_reason ?? null,
  }
}

async function parseStreamResponse(
  res: Response,
  model: string,
  onDelta?: (accumulatedText: string, chunk: string) => void,
  signal?: AbortSignal,
): Promise<OpenAiChatResult> {
  if (!res.ok) {
    const detail = await readErrorMessage(res)
    throw new OpenAiClientError('http_error', `OpenAI HTTP ${res.status}: ${detail}`, {
      httpStatus: res.status,
      retryable: isRetryableStatus(res.status),
    })
  }
  if (!res.body) {
    throw new OpenAiClientError('invalid_response', 'OpenAI stream missing response body', {
      retryable: true,
    })
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let accumulated = ''
  let usage: OpenAiTokenUsage | null = null
  let finishReason: string | null = null
  let resolvedModel = model

  try {
    while (true) {
      if (signal?.aborted) {
        throw new OpenAiClientError('aborted', 'Request aborted', { retryable: false })
      }
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload) continue
        if (payload === '[DONE]') continue
        let parsed: {
          model?: string
          usage?: unknown
          choices?: Array<{
            delta?: { content?: string }
            finish_reason?: string | null
          }>
        }
        try {
          parsed = JSON.parse(payload) as typeof parsed
        } catch {
          continue
        }
        if (parsed.model) resolvedModel = parsed.model
        const maybeUsage = parseUsage(parsed.usage)
        if (maybeUsage) usage = maybeUsage
        const choice = parsed.choices?.[0]
        if (choice?.finish_reason) finishReason = choice.finish_reason
        const chunk = choice?.delta?.content ?? ''
        if (chunk) {
          accumulated += chunk
          onDelta?.(accumulated, chunk)
        }
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
  }

  const text = accumulated.trim()
  if (!text) {
    throw new OpenAiClientError('empty_completion', 'OpenAI stream returned empty completion', {
      retryable: false,
    })
  }
  logUsage(resolvedModel, usage, { stream: true })
  return {
    text,
    model: resolvedModel,
    usage,
    finishReason,
  }
}

/**
 * Chat Completions with streaming (default), cancellation, timeout, retry, and usage logging.
 */
export async function openAiChatCompletion(request: OpenAiChatRequest): Promise<OpenAiChatResult> {
  const config = resolveOpenAiClientConfig()
  if (!config) {
    throw new OpenAiClientError('missing_api_key', 'OpenAI API key is not configured', {
      retryable: false,
    })
  }

  const preferStream = request.stream !== false

  return withRetries(config, request.signal, async () => {
    if (preferStream) {
      try {
        const res = await fetchOnce(config, request, true)
        return await parseStreamResponse(res, config.model, request.onDelta, request.signal)
      } catch (error) {
        // Some proxies reject stream_options / SSE — fall back once to non-stream.
        if (
          error instanceof OpenAiClientError
          && (error.code === 'http_error' || error.code === 'invalid_response')
          && !request.signal?.aborted
        ) {
          logChat('warn', 'openai', 'stream_fallback_to_non_stream', {
            code: error.code,
            httpStatus: error.httpStatus,
          })
          const res = await fetchOnce(config, request, false)
          const result = await parseNonStreamResponse(res, config.model)
          request.onDelta?.(result.text, result.text)
          return result
        }
        throw error
      }
    }
    const res = await fetchOnce(config, request, false)
    const result = await parseNonStreamResponse(res, config.model)
    request.onDelta?.(result.text, result.text)
    return result
  })
}
