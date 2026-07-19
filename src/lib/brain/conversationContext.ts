import type { ConversationContext } from './types'
import { createConversationContext } from './contextManager'

/**
 * ConversationContext factory/helpers (named export for sprint requirements).
 */
export const ConversationContextApi = {
  create: createConversationContext,
  snapshot(ctx: ConversationContext): ConversationContext {
    return createConversationContext(ctx.conversationId, ctx.locale)
  },
}

export { createConversationContext }
