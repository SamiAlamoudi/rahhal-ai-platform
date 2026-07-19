/**
 * Sprint 32 — StreamingResponse
 * Fake-token streaming of composed text (same pattern as travelAgentProvider).
 */

import type { ChatStreamChunk } from '../chatTypes'
import type { ConversationStructuredResponse } from './types'

export interface StreamingResponseOptions {
  chunkSize?: number
  delayMs?: number
  signal?: AbortSignal
  meta?: Record<string, unknown>
  onDelta?: (text: string) => void
}

/**
 * Stream rendered assistant text as ChatStreamChunk deltas, attaching structured meta on done.
 */
export async function* streamConversationResponse(
  renderedText: string,
  structured: ConversationStructuredResponse,
  options: StreamingResponseOptions = {},
): AsyncGenerator<ChatStreamChunk> {
  const chunkSize = options.chunkSize ?? 28
  const delayMs = options.delayMs ?? 6
  let index = 0

  while (index < renderedText.length) {
    if (options.signal?.aborted) {
      yield { type: 'error', error: 'cancelled' }
      return
    }
    const next = renderedText.slice(index, index + chunkSize)
    index += chunkSize
    options.onDelta?.(next)
    yield { type: 'delta', text: next }
    if (delayMs > 0) {
      await sleep(delayMs, options.signal)
    }
  }

  if (options.signal?.aborted) {
    yield { type: 'error', error: 'cancelled' }
    return
  }

  yield {
    type: 'done',
    meta: {
      conversationUi: true,
      structured,
      ...(options.meta ?? {}),
    },
  }
}

export class StreamingResponse {
  private readonly options: StreamingResponseOptions

  constructor(options: StreamingResponseOptions = {}) {
    this.options = options
  }

  stream(
    renderedText: string,
    structured: ConversationStructuredResponse,
    overrides?: StreamingResponseOptions,
  ): AsyncGenerator<ChatStreamChunk> {
    return streamConversationResponse(renderedText, structured, {
      ...this.options,
      ...overrides,
    })
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      resolve()
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
