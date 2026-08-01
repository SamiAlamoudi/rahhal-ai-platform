/**
 * Sprint 81 — ConversationPlanner (Brain v1).
 * Plans the next consultant move from intent + missing fields.
 */

import type {
  BrainV1Clarification,
  BrainV1Intent,
  BrainV1MissingField,
  BrainV1ToolId,
} from './types'

export type BrainV1Plan =
  | { kind: 'clarify', clarification: BrainV1Clarification }
  | { kind: 'search', tools: BrainV1ToolId[] }
  | { kind: 'advise', tools: BrainV1ToolId[] }
  | { kind: 'chat' }

export class ConversationPlanner {
  plan(input: {
    intent: BrainV1Intent
    missing: BrainV1MissingField[]
    clarifications: BrainV1Clarification[]
    tools: BrainV1ToolId[]
  }): BrainV1Plan {
    if (input.clarifications[0]) {
      return { kind: 'clarify', clarification: input.clarifications[0] }
    }

    if (
      input.intent === 'general_conversation'
      || input.intent === 'unknown'
      || input.intent === 'travel_advice'
    ) {
      if (input.tools.includes('advice')) {
        return { kind: 'advise', tools: input.tools }
      }
      return { kind: 'chat' }
    }

    if (input.tools.some((t) => t !== 'none')) {
      return { kind: 'search', tools: input.tools }
    }

    return { kind: 'advise', tools: input.tools }
  }
}

export function createConversationPlanner(): ConversationPlanner {
  return new ConversationPlanner()
}
