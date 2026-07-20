/**
 * Sprint 44 — feature gate for ChatGPT-like conversation experience.
 */

import { getFeatureRegistry } from '../../ai'
import { isConversationExperienceEnabled } from '../conversationExperienceUi/feature'

export const CHATGPT_EXPERIENCE_FEATURE_ID = 'ui.chatgpt_experience' as const

export function isChatGptExperienceEnabled(options?: {
  chatgptExperienceEnabled?: boolean
}): boolean {
  if (typeof options?.chatgptExperienceEnabled === 'boolean') {
    return options.chatgptExperienceEnabled
  }
  if (!isConversationExperienceEnabled()) return false
  return getFeatureRegistry().isEnabled('ui.chatgpt_experience')
}
