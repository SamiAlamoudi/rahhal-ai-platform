/**
 * Sprint 81 — ConversationHistory (Brain v1).
 */

export type BrainV1HistoryMessage = {
  role: 'user' | 'assistant'
  text: string
  at: string
}

export class ConversationHistory {
  private messages: BrainV1HistoryMessage[] = []

  constructor(seed?: Array<{ role: 'user' | 'assistant', text: string }>) {
    for (const row of seed ?? []) {
      this.append(row.role, row.text)
    }
  }

  append(role: 'user' | 'assistant', text: string): void {
    this.messages.push({
      role,
      text,
      at: new Date().toISOString(),
    })
  }

  list(): BrainV1HistoryMessage[] {
    return [...this.messages]
  }

  lastUserText(): string | null {
    for (let i = this.messages.length - 1; i >= 0; i -= 1) {
      if (this.messages[i]?.role === 'user') return this.messages[i]!.text
    }
    return null
  }

  turnCount(): number {
    return this.messages.filter((m) => m.role === 'user').length
  }
}

export function createConversationHistory(
  seed?: Array<{ role: 'user' | 'assistant', text: string }>,
): ConversationHistory {
  return new ConversationHistory(seed)
}
