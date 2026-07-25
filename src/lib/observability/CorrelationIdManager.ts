/**
 * Sprint 15 — CorrelationIdManager (request / conversation correlation).
 */

import type { CorrelationContext } from './types'

function randomId(prefix: string): string {
  const part = Math.random().toString(36).slice(2, 10)
  const time = Date.now().toString(36)
  return `${prefix}_${time}_${part}`
}

export class CorrelationIdManager {
  private context: CorrelationContext = {
    requestId: randomId('req'),
    conversationId: null,
    provider: null,
    module: null,
  }

  createRequestId(): string {
    this.context.requestId = randomId('req')
    return this.context.requestId
  }

  setConversationId(conversationId: string | null): void {
    this.context.conversationId = conversationId
  }

  setProvider(provider: string | null): void {
    this.context.provider = provider
  }

  setModule(module: string | null): void {
    this.context.module = module
  }

  runWith<T>( partial: Partial<CorrelationContext>, fn: () => T): T {
    const prev = { ...this.context }
    this.context = {
      requestId: partial.requestId ?? prev.requestId,
      conversationId: partial.conversationId !== undefined ? partial.conversationId : prev.conversationId,
      provider: partial.provider !== undefined ? partial.provider : prev.provider,
      module: partial.module !== undefined ? partial.module : prev.module,
    }
    try {
      return fn()
    } finally {
      this.context = prev
    }
  }

  current(): CorrelationContext {
    return { ...this.context }
  }

  reset(): void {
    this.context = {
      requestId: randomId('req'),
      conversationId: null,
      provider: null,
      module: null,
    }
  }
}

let shared: CorrelationIdManager | null = null

export function getCorrelationIdManager(): CorrelationIdManager {
  if (!shared) shared = new CorrelationIdManager()
  return shared
}

export function resetCorrelationIdManagerForTests(): void {
  shared?.reset()
  shared = null
}
