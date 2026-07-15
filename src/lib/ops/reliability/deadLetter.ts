/**
 * Dead-letter inspection utilities for failed async ops / queue recovery.
 */

export interface DeadLetterItem {
  id: string
  domain: string
  operation: string
  error: string
  payload: Record<string, unknown>
  attempts: number
  createdAt: string
  lastAttemptAt: string
}

export class DeadLetterQueue {
  private readonly items: DeadLetterItem[] = []

  push(input: Omit<DeadLetterItem, 'id' | 'createdAt' | 'lastAttemptAt'> & {
    id?: string
  }): DeadLetterItem {
    const now = new Date().toISOString()
    const item: DeadLetterItem = {
      id: input.id ?? `dlq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      domain: input.domain,
      operation: input.operation,
      error: input.error,
      payload: { ...input.payload },
      attempts: input.attempts,
      createdAt: now,
      lastAttemptAt: now,
    }
    this.items.push(item)
    return item
  }

  list(domain?: string): DeadLetterItem[] {
    return this.items
      .filter((i) => (domain ? i.domain === domain : true))
      .map((i) => ({ ...i, payload: { ...i.payload } }))
  }

  requeue(id: string): DeadLetterItem | null {
    const idx = this.items.findIndex((i) => i.id === id)
    if (idx < 0) return null
    const [item] = this.items.splice(idx, 1)
    return item
  }

  clear(): void {
    this.items.length = 0
  }
}

let defaultDlq: DeadLetterQueue | null = null

export function getDeadLetterQueue(): DeadLetterQueue {
  if (!defaultDlq) defaultDlq = new DeadLetterQueue()
  return defaultDlq
}

export function resetDeadLetterQueue(): void {
  defaultDlq?.clear()
  defaultDlq = null
}
