import type { ConversationHistory, ConversationHistoryTurn, TravelIntent } from './types'

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function createEmptyHistory(conversationId: string): ConversationHistory {
  return { conversationId, turns: [] }
}

export const ConversationHistoryApi = {
  create: createEmptyHistory,

  append(
    history: ConversationHistory,
    input: {
      role: ConversationHistoryTurn['role']
      content: string
      intent?: TravelIntent | null
    },
  ): ConversationHistory {
    const turn: ConversationHistoryTurn = {
      id: newId('bht'),
      role: input.role,
      content: input.content,
      intent: input.intent ?? null,
      createdAt: new Date().toISOString(),
    }
    return {
      conversationId: history.conversationId,
      turns: [...history.turns, turn],
    }
  },

  list(history: ConversationHistory): ConversationHistoryTurn[] {
    return history.turns.map((t) => ({ ...t }))
  },
}
