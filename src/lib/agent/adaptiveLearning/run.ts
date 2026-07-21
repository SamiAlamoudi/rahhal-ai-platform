/**
 * Sprint 80 — run adaptive learning for a conversation turn (local only).
 */

import {
  createAdaptiveLearningEngine,
  getPreferenceStore,
  type AdaptiveLearningResult,
  type FeedbackInput,
  type TravelerProfile,
} from '../../../core'
import { isAdaptiveLearningEnabled } from './feature'

export function runAdaptiveLearningTurn(input: {
  userId: string
  userText?: string | null
  feedback?: FeedbackInput | FeedbackInput[]
  enabled?: boolean
}): AdaptiveLearningResult | null {
  if (!isAdaptiveLearningEnabled({ enabled: input.enabled })) return null
  if (!input.userId) return null
  return createAdaptiveLearningEngine(getPreferenceStore()).learn({
    userId: input.userId,
    userText: input.userText,
    feedback: input.feedback,
  })
}

export function getLearnedProfile(userId: string): TravelerProfile | null {
  if (!userId) return null
  return getPreferenceStore().get(userId)
}

export function resetAdaptiveLearningProfile(userId: string): void {
  createAdaptiveLearningEngine().resetProfile(userId)
}

export function setAdaptiveLearningEnabled(
  userId: string,
  enabled: boolean,
): TravelerProfile | null {
  return createAdaptiveLearningEngine().setLearningEnabled(userId, enabled)
}
