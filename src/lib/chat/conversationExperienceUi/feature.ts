/**
 * Sprint 42 — Conversation Experience UI feature gate.
 * Presentation layer only; depends on Sprint 32 conversation UI (and thus planner chain).
 */

import { getFeatureRegistry } from '../../ai'
import { isConversationUiEnabled } from '../conversationExperience/feature'

export const CONVERSATION_EXPERIENCE_FEATURE_ID = 'ui.conversation_experience' as const

export function isConversationExperienceEnabled(options?: {
  conversationExperienceEnabled?: boolean
}): boolean {
  if (typeof options?.conversationExperienceEnabled === 'boolean') {
    return options.conversationExperienceEnabled
  }
  if (!isConversationUiEnabled()) return false
  return getFeatureRegistry().isEnabled('ui.conversation_experience')
}
